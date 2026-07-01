import dgram from 'react-native-udp';
import { Buffer } from 'buffer';
import { encode, decodePacket } from '../osc/osc';
import { DiscoveredMixer, parseInfoReply, broadcastTargets, sweepTargets } from './discovery';

const X32_PORT = 10023;
const DEFAULT_TIMEOUT_MS = 8000;
/**
 * O sweep unicast da /24 são ~253 IPs × 2 probes. Disparar tudo de uma vez estoura
 * o buffer de envio do socket no iPhone físico (ENOBUFS) e a maioria dos pacotes
 * nunca sai — a busca "roda" sem achar nada. Por isso enviamos em lotes espaçados.
 */
const SWEEP_BATCH_SIZE = 12;
const SWEEP_BATCH_INTERVAL_MS = 25;
/** Nº de passadas do sweep (a mesa pode perder o 1º pacote numa rajada). */
const SWEEP_PASSES = 2;

/** Mesmo cast pontual usado no X32Client (Expo não traz os tipos do EventEmitter). */
type UdpSocket = ReturnType<typeof dgram.createSocket> & {
  on(event: string, cb: (...args: any[]) => void): void;
  once(event: string, cb: (...args: any[]) => void): void;
  setBroadcast(flag: boolean): void;
};

/** Diagnóstico da varredura — exibido na tela de busca para não ficarmos no escuro. */
export interface DiscoveryDiag {
  /** IP local detectado (base do sweep/broadcast). null = não detectado → sweep vazio. */
  localIp: string | null;
  /** Prefixo /24 derivado (ex.: "192.168.1"). */
  subnet: string | null;
  /** Quantos hosts o sweep unicast cobre. */
  sweepCount: number;
  /** Endereços de broadcast tentados. */
  broadcast: string[];
  /** Pacotes UDP enviados com sucesso e com erro (ENOBUFS etc.). */
  sent: number;
  sendErrors: number;
}

export interface DiscoverOptions {
  /** IP local do dispositivo, para derivar o broadcast /24 (ex.: via expo-network). */
  localIp?: string | null;
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
 * Descobre mesas X32/M32 na rede local. Combina broadcast /24 (OSC /xinfo — método
 * confiável quando a rede permite; bloqueado no iPhone sem entitlement de multicast)
 * com varredura UNICAST da sub-rede (funciona no device sem entitlement). Resolve com
 * a lista (deduplicada por IP) após o timeout.
 */
export function discoverMixers(opts: DiscoverOptions = {}): Promise<DiscoveredMixer[]> {
  const { localIp, timeoutMs = DEFAULT_TIMEOUT_MS, onFound, onDiag } = opts;

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4' }) as UdpSocket;
    const found = new Map<string, DiscoveredMixer>();
    let settled = false;
    let batchTimer: ReturnType<typeof setInterval> | null = null;

    const sweep = sweepTargets(localIp);
    const broadcast = broadcastTargets(localIp);
    const diag: DiscoveryDiag = {
      localIp: localIp ?? null,
      subnet: subnetPrefix(localIp),
      sweepCount: sweep.length,
      broadcast,
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

    socket.on('message', (data: Buffer | Uint8Array, rinfo: { address: string }) => {
      let messages;
      try {
        messages = decodePacket(Buffer.from(data as Uint8Array));
      } catch {
        return;
      }
      for (const msg of messages) {
        const mixer = parseInfoReply(msg, rinfo?.address ?? '');
        if (mixer && mixer.ip && !found.has(mixer.ip)) {
          found.set(mixer.ip, mixer);
          onFound?.(mixer);
        }
      }
    });

    socket.once('listening', () => {
      try {
        socket.setBroadcast(true);
      } catch {
        /* alguns ambientes não permitem; segue mesmo assim */
      }
      // /xinfo é o comando de descoberta (resposta traz o IP da mesa); /info é o mesmo
      // usado na conexão manual. Mandamos os dois para cobrir ambos os caminhos.
      const probes = [encode('/xinfo'), encode('/info')];
      const send = (target: string) => {
        for (const probe of probes) {
          socket.send(probe, 0, probe.length, X32_PORT, target, (err?: Error) => {
            // Falha em um alvo isolado não aborta os demais — só contabiliza.
            if (err) diag.sendErrors++;
            else diag.sent++;
          });
        }
      };

      // Broadcast: poucos alvos, vai de uma vez (só funciona em redes/ambientes permissivos).
      broadcast.forEach(send);
      // Reporta os alvos logo no início (a UI já mostra IP/sub-rede enquanto varre).
      onDiag?.(diag);

      // Varredura UNICAST em lotes espaçados (não estoura o buffer do socket no device),
      // repetida SWEEP_PASSES vezes (a mesa pode perder o 1º pacote numa rajada).
      let i = 0;
      let pass = 1;
      batchTimer = setInterval(() => {
        if (settled) {
          stopBatch();
          return;
        }
        const end = Math.min(i + SWEEP_BATCH_SIZE, sweep.length);
        for (; i < end; i++) send(sweep[i]);
        if (i >= sweep.length) {
          if (pass < SWEEP_PASSES) {
            pass++;
            i = 0;
            broadcast.forEach(send); // reforça o broadcast a cada passada
          } else {
            stopBatch();
          }
        }
      }, SWEEP_BATCH_INTERVAL_MS);
    });

    socket.bind(0);
  });
}
