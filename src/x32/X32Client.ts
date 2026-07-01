import dgram from 'react-native-udp';
import { Buffer } from 'buffer';
import { encode, decodePacket, OscArg, OscArgValue, OscMessage } from '../osc/osc';
import { X32, CHANNEL_COUNT, BUS_COUNT } from './addresses';
import { DiscoveredMixer, isInfoReply, parseInfoReply } from './discovery';

export const X32_PORT = 10023;

/** Reenviamos /xremote com folga antes do timeout de ~10s da mesa. */
const XREMOTE_INTERVAL_MS = 8000;
/** Sem nenhuma resposta nesse intervalo, consideramos a conexão perdida. */
const CONNECTION_TIMEOUT_MS = 6000;
/** Renovação da subscription de meters (alias expira em ~10s). */
const METER_RENEW_MS = 6000;
/**
 * time_factor da subscription de meters: intervalo = 50ms * tf. tf=1 → 50ms (20 Hz),
 * fluido como o app oficial. Antes usávamos 5 (250ms/4 Hz) — VU travado.
 */
const METER_TIME_FACTOR = 1;
/** Handshake: reenvia /info nesse intervalo até a mesa responder. */
const HANDSHAKE_INTERVAL_MS = 800;
/** Nº de sondagens /info sem resposta antes de declarar "não é uma mesa". */
const HANDSHAKE_MAX_ATTEMPTS = 5;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * O UdpSocket do react-native-udp estende EventEmitter de 'events', mas o tsconfig
 * base do Expo não traz os tipos do Node, então `on`/`once` não aparecem. Adicionamos
 * aqui apenas o que usamos, mantendo send/bind/close já tipados pela própria lib.
 */
type UdpSocket = ReturnType<typeof dgram.createSocket> & {
  on(event: string, cb: (...args: any[]) => void): void;
  once(event: string, cb: (...args: any[]) => void): void;
};

export type MessageListener = (msg: OscMessage) => void;
export type StatusListener = (status: ConnectionStatus, detail?: string) => void;
export type MeterListener = (levels: Float32Array) => void;

/**
 * Cliente da mesa Behringer X32 / Midas M32 via OSC sobre UDP.
 *
 * Responsabilidades:
 *  - abrir/fechar o socket UDP e falar com IP_DA_MESA:10023
 *  - handshake (/info) e manutenção da inscrição (/xremote a cada ~8s)
 *  - setters de alto nível (send level/pan/on, mute) e leitura de valores
 *  - distribuir mensagens recebidas para listeners (o store assina isso)
 *  - subscription de metering (best-effort)
 *
 * É agnóstico de UI: não importa React. O store (useMixerStore) faz a ponte.
 */
export class X32Client {
  private socket: UdpSocket | null = null;
  private host: string | null = null;
  private status: ConnectionStatus = 'disconnected';

  private xremoteTimer: ReturnType<typeof setInterval> | null = null;
  private meterRenewTimer: ReturnType<typeof setInterval> | null = null;
  private handshakeTimer: ReturnType<typeof setInterval> | null = null;
  private lastRxAt = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  /** Dados da mesa validada no handshake (nome/modelo/firmware), ou null. */
  private mixerInfo: DiscoveredMixer | null = null;

  private messageListeners = new Set<MessageListener>();
  private statusListeners = new Set<StatusListener>();
  private meterListeners = new Set<MeterListener>();

  // Alias do /batchsubscribe: DEVE começar com '/' — vira o endereço OSC das respostas.
  private readonly meterAlias = '/mtr';

  // ---------- assinaturas ----------

  onMessage(cb: MessageListener): () => void {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  onMeter(cb: MeterListener): () => void {
    this.meterListeners.add(cb);
    return () => this.meterListeners.delete(cb);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** Mesa validada no handshake (nome/modelo/firmware), ou null se não conectado. */
  getMixerInfo(): DiscoveredMixer | null {
    return this.mixerInfo;
  }

  private setStatus(status: ConnectionStatus, detail?: string) {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status, detail));
  }

  // ---------- ciclo de vida ----------

  connect(host: string) {
    this.disconnect();
    this.host = host;
    this.mixerInfo = null;
    this.setStatus('connecting');

    const socket = dgram.createSocket({ type: 'udp4' }) as UdpSocket;
    this.socket = socket;

    socket.on('error', (err: Error) => {
      this.setStatus('error', err?.message ?? 'erro de socket');
    });

    socket.on('message', (data: Buffer | Uint8Array) => {
      this.lastRxAt = Date.now();
      // NÃO promovemos para 'connected' por qualquer pacote: só o handshake
      // (/info válido) confirma que há mesmo uma X32/M32 nesse IP — ver handleIncoming.
      this.handleIncoming(Buffer.from(data as Uint8Array));
    });

    socket.once('listening', () => {
      // Valida que o IP é REALMENTE uma mesa antes de declarar conexão.
      this.startHandshake();
    });

    // bind(0) escolhe uma porta local livre; a mesa responde nessa porta.
    socket.bind(0);
  }

  disconnect() {
    this.stopTimer('xremoteTimer');
    this.stopTimer('meterRenewTimer');
    this.stopTimer('watchdog');
    this.stopTimer('handshakeTimer');
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.host = null;
    this.mixerInfo = null;
    if (this.status !== 'disconnected') this.setStatus('disconnected');
  }

  private stopTimer(key: 'xremoteTimer' | 'meterRenewTimer' | 'watchdog' | 'handshakeTimer') {
    const t = this[key];
    if (t) {
      clearInterval(t);
      this[key] = null;
    }
  }

  /**
   * Handshake: pinga /info repetidamente até a mesa responder (validação) ou
   * esgotar as tentativas (= não há mesa nesse IP -> erro). Só após validar é que
   * subimos para 'connected' e iniciamos xremote/watchdog.
   */
  private startHandshake() {
    this.stopTimer('handshakeTimer');
    let attempts = 1; // a primeira sondagem é enviada já abaixo
    this.send(X32.info());
    this.handshakeTimer = setInterval(() => {
      if (this.status !== 'connecting') {
        this.stopTimer('handshakeTimer');
        return;
      }
      attempts++;
      if (attempts > HANDSHAKE_MAX_ATTEMPTS) {
        this.stopTimer('handshakeTimer');
        this.failConnection('Nenhuma mesa X32/M32 encontrada nesse IP');
        return;
      }
      this.send(X32.info());
    }, HANDSHAKE_INTERVAL_MS);
  }

  /** Encerra a tentativa de conexão com erro (fecha socket, mantém host p/ retry). */
  private failConnection(detail: string) {
    this.stopTimer('handshakeTimer');
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.setStatus('error', detail);
  }

  private startXremote() {
    this.stopTimer('xremoteTimer');
    this.send(X32.xremote());
    this.xremoteTimer = setInterval(() => this.send(X32.xremote()), XREMOTE_INTERVAL_MS);
  }

  private startWatchdog() {
    this.stopTimer('watchdog');
    this.lastRxAt = Date.now();
    this.watchdog = setInterval(() => {
      if (this.status === 'connected' && Date.now() - this.lastRxAt > CONNECTION_TIMEOUT_MS) {
        this.setStatus('connecting', 'sem resposta da mesa');
        // Tenta reanimar pingando /info de novo.
        this.send(X32.info());
      }
    }, 2000);
  }

  // ---------- envio ----------

  /** Envia uma mensagem OSC. Sem args = leitura (a mesa responde com o valor atual). */
  send(address: string, args: Array<OscArg | OscArgValue> = []) {
    if (!this.socket || !this.host) return;
    const buf = encode(address, args);
    this.socket.send(buf, 0, buf.length, X32_PORT, this.host, (err?: Error) => {
      if (err) this.setStatus('error', err.message);
    });
  }

  // ---------- setters de alto nível ----------

  setSendLevel(ch: number, bus: number, value: number) {
    this.send(X32.sendLevel(ch, bus), [{ type: 'f', value: clamp01(value) }]);
  }

  setSendPan(ch: number, bus: number, value: number) {
    this.send(X32.sendPan(ch, bus), [{ type: 'f', value: clamp01(value) }]);
  }

  setSendOn(ch: number, bus: number, on: boolean) {
    this.send(X32.sendOn(ch, bus), [{ type: 'i', value: on ? 1 : 0 }]);
  }

  /** Volume master do bus de retorno (fone) selecionado. */
  setBusMaster(bus: number, value: number) {
    this.send(X32.busFader(bus), [{ type: 'f', value: clamp01(value) }]);
  }

  // ---------- leitura de estado ----------

  /** Pede nome e cor de todos os canais (popula a UI ao conectar). */
  requestChannelMeta() {
    for (let ch = 1; ch <= CHANNEL_COUNT; ch++) {
      this.send(X32.channelName(ch));
      this.send(X32.channelColor(ch));
    }
  }

  /** Pede os nomes de todos os buses (para o seletor de retorno). */
  requestBusNames() {
    for (let bus = 1; bus <= BUS_COUNT; bus++) {
      this.send(X32.busName(bus));
    }
  }

  /** Pede os sends (level/pan/on) de todos os canais + o master do bus selecionado. */
  requestBusSends(bus: number) {
    this.send(X32.busFader(bus)); // volume master do retorno
    for (let ch = 1; ch <= CHANNEL_COUNT; ch++) {
      this.send(X32.sendLevel(ch, bus));
      this.send(X32.sendPan(ch, bus));
      this.send(X32.sendOn(ch, bus));
    }
  }

  // ---------- metering (best-effort, validar com hardware) ----------

  /**
   * Inscreve no banco de meters de entrada (/meters/1) e renova periodicamente.
   * Se a mesa não cooperar, a mixagem continua funcionando — meter é cosmético.
   */
  subscribeMeters() {
    this.stopTimer('meterRenewTimer');
    const subscribe = () => {
      // Forma 1: /subscribe simples — resposta chega em "/meters/1".
      this.send('/subscribe', [
        { type: 's', value: '/meters/1' },
        { type: 'i', value: METER_TIME_FACTOR },
      ]);
      // Forma 2: /batchsubscribe com alias — resposta chega no próprio alias.
      this.send('/batchsubscribe', [
        { type: 's', value: this.meterAlias },
        { type: 's', value: '/meters/1' },
        { type: 'i', value: 0 },
        { type: 'i', value: 0 },
        { type: 'i', value: METER_TIME_FACTOR },
      ]);
    };
    subscribe();
    // Assinaturas expiram em ~10s: renova as duas formas periodicamente.
    this.meterRenewTimer = setInterval(() => {
      this.send('/renew', [{ type: 's', value: this.meterAlias }]);
      this.send('/renew', [{ type: 's', value: '/meters/1' }]);
    }, METER_RENEW_MS);
  }

  // ---------- recepção ----------

  private handleIncoming(buf: Buffer) {
    let messages: OscMessage[];
    try {
      messages = decodePacket(buf);
    } catch {
      return; // pacote malformado: ignora
    }
    for (const msg of messages) {
      // Handshake: a 1ª resposta /info válida confirma a mesa e sobe p/ 'connected'.
      // Também re-promove após uma queda momentânea (watchdog volta p/ 'connecting').
      if (this.status === 'connecting' && isInfoReply(msg)) {
        this.onHandshakeSuccess(msg);
      }
      if (this.isMeterBlob(msg)) {
        this.emitMeters(msg);
      }
      this.messageListeners.forEach((cb) => cb(msg));
    }
  }

  /** Mesa validada: guarda info, sobe p/ 'connected' e liga inscrição/watchdog. */
  private onHandshakeSuccess(msg: OscMessage) {
    this.stopTimer('handshakeTimer');
    this.mixerInfo = parseInfoReply(msg, this.host ?? '');
    this.lastRxAt = Date.now();
    this.startXremote();
    this.startWatchdog();
    const label = this.mixerInfo?.model || this.mixerInfo?.name || undefined;
    this.setStatus('connected', label);
  }

  private isMeterBlob(msg: OscMessage): boolean {
    // Qualquer resposta em blob é tratada como meter — a X32 pode endereçá-la
    // em "/meters/..." OU no alias da subscription (ex.: "earmix").
    return msg.args[0]?.type === 'b';
  }

  /**
   * Parser do blob de meters: int32(count, little-endian) + count floats LE.
   * Os primeiros valores correspondem aos canais de entrada. Os valores da X32 são
   * amplitude LINEAR (1.0 = 0 dBFS); convertemos para dB e mapeamos -60..0 dBFS
   * em 0..1 para o VU subir como um medidor de verdade.
   */
  private emitMeters(msg: OscMessage) {
    const blob = msg.args[0]?.value;
    if (!Buffer.isBuffer(blob) || blob.length < 4) return;
    const count = blob.readInt32LE(0);
    const levels = new Float32Array(Math.min(count, CHANNEL_COUNT));
    for (let i = 0; i < levels.length; i++) {
      const off = 4 + i * 4;
      if (off + 4 > blob.length) break;
      levels[i] = linearToMeter(blob.readFloatLE(off));
    }
    this.meterListeners.forEach((cb) => cb(levels));
  }
}

/** dBFS exibidos no fundo do VU (abaixo disso = apagado). */
const METER_FLOOR_DB = -60;

/** Amplitude linear (0..1) → fração de VU (0..1) via escala de dB. */
function linearToMeter(v: number): number {
  if (v <= 0) return 0;
  const db = 20 * Math.log10(v);
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Instância única compartilhada pela app. */
export const x32 = new X32Client();
