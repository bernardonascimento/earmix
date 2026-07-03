import dgram from 'react-native-udp';
import { Buffer } from 'buffer';
import { encode, decodePacket } from '../osc/osc';
import { DiscoveredMixer, parseInfoReply, sweepTargets } from './discovery';

const X32_PORT = 10023;
const DEFAULT_TIMEOUT_MS = 9000;
/**
 * Varredura UNICAST da /24 em lotes pequenos e espaçados. Descoberta usa EXATAMENTE
 * o mesmo caminho da conexão manual (que funciona no device): unicast + probe /info,
 * SEM setBroadcast e SEM enviar para endereços de broadcast — no iOS o broadcast é
 * bloqueado (sem entitlement de multicast) e ligar SO_BROADCAST parecia derrubar a
 * recepção das respostas unicast. O IP da mesa vem do endereço de origem do pacote.
 */
const SWEEP_BATCH_SIZE = 8;
const SWEEP_BATCH_INTERVAL_MS = 35;
/** Nº de passadas do sweep (a mesa pode perder o 1º pacote). */
const SWEEP_PASSES = 2;
/**
 * Após achar a primeira mesa, encerramos logo (sem varrer o resto) — mas damos uma
 * folga para a resposta /xinfo chegar e trazer o nome real da mesa (em vez do genérico
 * "osc-server" do /info).
 */
const FOUND_GRACE_MS = 700;

/** Mesmo cast pontual usado no X32Client (Expo não traz os tipos do EventEmitter). */
type UdpSocket = ReturnType<typeof dgram.createSocket> & {
  on(event: string, cb: (...args: any[]) => void): void;
  once(event: string, cb: (...args: any[]) => void): void;
};

/** Diagnóstico da varredura — exibido na tela de busca para não ficarmos no escuro. */
export interface DiscoveryDiag {
  /** IP local detectado (base do sweep). null = não detectado → sweep vazio. */
  localIp: string | null;
  /** Prefixo /24 derivado (ex.: "192.168.1"). */
  subnet: string | null;
  /** Quantos hosts o sweep unicast cobre. */
  sweepCount: number;
  /** Pacotes UDP enviados com sucesso e com erro. */
  sent: number;
  sendErrors: number;
}

export interface DiscoverOptions {
  /** IP base para derivar a sub-rede /24 a varrer (IP local real, ou o da mesa/campo). */
  localIp?: string | null;
  /** IP REAL do dispositivo, para excluir a si mesmo do sweep (opcional). */
  selfIp?: string | null;
  /** Lista de IPs a sondar já pronta (tem prioridade sobre localIp — permite varrer N /24). */
  targets?: string[];
  /** Quanto tempo aguardar respostas antes de finalizar. */
  timeoutMs?: number;
  /** Callback incremental conforme cada mesa responde. */
  onFound?: (mixer: DiscoveredMixer) => void;
  /** Callback de diagnóstico (chamado no início com os alvos e no fim com as contagens). */
  onDiag?: (diag: DiscoveryDiag) => void;
}

/** Prefixo /24 de um IPv4 ("192.168.1.34" -> "192.168.1"), ou null. */
function subnetPrefix(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(ip);
  return m ? m[1] : null;
}

/**
 * Descobre mesas X32/M32 na rede local por varredura UNICAST da sub-rede /24, usando
 * o mesmo caminho da conexão manual (probe /info na porta 10023). Resolve com a lista
 * (deduplicada por IP) após o timeout.
 */
export function discoverMixers(opts: DiscoverOptions = {}): Promise<DiscoveredMixer[]> {
  const { localIp, selfIp, targets, timeoutMs = DEFAULT_TIMEOUT_MS, onFound, onDiag } = opts;

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4' }) as UdpSocket;
    const found = new Map<string, DiscoveredMixer>();
    let settled = false;
    let batchTimer: ReturnType<typeof setInterval> | null = null;
    let foundTimer: ReturnType<typeof setTimeout> | null = null;

    // Lista pronta (uma ou várias /24) tem prioridade; senão deriva de localIp.
    // selfIp null = base estimada (ex.: IP da mesa): NÃO exclui ninguém do sweep.
    const sweep =
      targets && targets.length
        ? targets
        : sweepTargets(localIp, selfIp === undefined ? localIp : selfIp);
    const diag: DiscoveryDiag = {
      localIp: localIp ?? null,
      subnet: subnetPrefix(localIp),
      sweepCount: sweep.length,
      sent: 0,
      sendErrors: 0,
    };

    const stopBatch = () => {
      if (batchTimer) {
        clearInterval(batchTimer);
        batchTimer = null;
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (foundTimer) clearTimeout(foundTimer);
      stopBatch();
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      onDiag?.(diag); // diagnóstico final (com contagens de envio)
      resolve([...found.values()]);
    };

    const timer = setTimeout(finish, timeoutMs);

    socket.on('error', (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stopBatch();
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      reject(err);
    });

    const xinfo = encode('/xinfo');
    const info = encode('/info');
    const sendProbe = (target: string, probe: Buffer) => {
      socket.send(probe, 0, probe.length, X32_PORT, target, (err?: Error) => {
        // Falha isolada (ex.: EHOSTUNREACH de IP inexistente) não aborta os demais.
        if (err) diag.sendErrors++;
        else diag.sent++;
      });
    };

    socket.on('message', (data: Buffer | Uint8Array, rinfo: { address: string }) => {
      let messages;
      try {
        messages = decodePacket(Buffer.from(data as Uint8Array));
      } catch {
        return;
      }
      for (const msg of messages) {
        const mixer = parseInfoReply(msg, rinfo?.address ?? '');
        if (!mixer || !mixer.ip) continue;
        // /info devolve nome genérico "osc-server"; enquanto o /xinfo (nome real) não
        // chega, mostramos o modelo em vez do genérico.
        if (!mixer.name || mixer.name === 'osc-server') mixer.name = mixer.model || 'Mesa';
        const known = found.get(mixer.ip);
        if (!known) {
          found.set(mixer.ip, mixer);
          onFound?.(mixer);
          // Achou uma mesa: encerra logo, dando uma folga para o /xinfo trazer o nome real.
          if (!foundTimer) foundTimer = setTimeout(finish, FOUND_GRACE_MS);
          // /info dá nome genérico; pede /xinfo ao MESMO IP para o nome real (unicast).
          if (msg.address === '/info') sendProbe(mixer.ip, xinfo);
        } else if (msg.address === '/xinfo') {
          // /xinfo traz o nome real da mesa — atualiza o registro.
          found.set(mixer.ip, mixer);
          onFound?.(mixer);
        }
      }
    });

    socket.once('listening', () => {
      onDiag?.(diag); // a UI já mostra IP/sub-rede enquanto varre

      // Varredura UNICAST GENTIL com /info (o mesmo probe da conexão manual, que
      // funciona no device), em lotes espaçados, repetida SWEEP_PASSES vezes.
      let i = 0;
      let pass = 1;
      batchTimer = setInterval(() => {
        if (settled) {
          stopBatch();
          return;
        }
        const end = Math.min(i + SWEEP_BATCH_SIZE, sweep.length);
        for (; i < end; i++) sendProbe(sweep[i], info);
        if (i >= sweep.length) {
          if (pass < SWEEP_PASSES) {
            pass++;
            i = 0;
          } else {
            stopBatch();
          }
        }
      }, SWEEP_BATCH_INTERVAL_MS);
    });

    socket.bind(0);
  });
}
