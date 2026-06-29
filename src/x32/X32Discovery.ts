import dgram from 'react-native-udp';
import { Buffer } from 'buffer';
import { encode, decodePacket } from '../osc/osc';
import { DiscoveredMixer, parseInfoReply, broadcastTargets, sweepTargets } from './discovery';

const X32_PORT = 10023;
const DEFAULT_TIMEOUT_MS = 6000;
/**
 * O sweep unicast da /24 são ~253 IPs × 2 probes. Disparar tudo de uma vez estoura
 * o buffer de envio do socket no iPhone físico (ENOBUFS) e a maioria dos pacotes
 * nunca sai — a busca "roda" sem achar nada. Por isso enviamos em lotes espaçados.
 */
const SWEEP_BATCH_SIZE = 12;
const SWEEP_BATCH_INTERVAL_MS = 25;

/** Mesmo cast pontual usado no X32Client (Expo não traz os tipos do EventEmitter). */
type UdpSocket = ReturnType<typeof dgram.createSocket> & {
  on(event: string, cb: (...args: any[]) => void): void;
  once(event: string, cb: (...args: any[]) => void): void;
  setBroadcast(flag: boolean): void;
};

export interface DiscoverOptions {
  /** IP local do dispositivo, para derivar o broadcast /24 (ex.: via expo-network). */
  localIp?: string | null;
  /** Quanto tempo aguardar respostas antes de finalizar. */
  timeoutMs?: number;
  /** Callback incremental conforme cada mesa responde. */
  onFound?: (mixer: DiscoveredMixer) => void;
}

/**
 * Descobre mesas X32/M32 na rede local enviando um broadcast OSC /xinfo na porta 10023
 * e coletando as respostas. Resolve com a lista (deduplicada por IP) após o timeout.
 *
 * Requer permissão de rede local no iOS (já declarada em app.json) e que o roteador
 * não bloqueie broadcast UDP — comum em redes de palco/domésticas.
 */
export function discoverMixers(opts: DiscoverOptions = {}): Promise<DiscoveredMixer[]> {
  const { localIp, timeoutMs = DEFAULT_TIMEOUT_MS, onFound } = opts;

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4' }) as UdpSocket;
    const found = new Map<string, DiscoveredMixer>();
    let settled = false;
    let batchTimer: ReturnType<typeof setInterval> | null = null;

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
      // Manda /xinfo E /info: a X32 responde ao /info de forma confiável
      // (mesma usada na conexão manual); /xinfo nem sempre responde igual.
      const probes = [encode('/xinfo'), encode('/info')];
      const send = (target: string) => {
        for (const probe of probes) {
          socket.send(probe, 0, probe.length, X32_PORT, target, (err?: Error) => {
            // Falha em um alvo isolado não aborta os demais.
            void err;
          });
        }
      };

      // Broadcast (funciona no emulador / redes permissivas) — poucos alvos, vai de uma vez.
      broadcastTargets(localIp).forEach(send);

      // Varredura UNICAST da sub-rede — é o que funciona no iPhone físico.
      // Enviada em lotes espaçados para não estourar o buffer de envio do socket.
      const sweep = sweepTargets(localIp);
      let i = 0;
      batchTimer = setInterval(() => {
        if (settled) {
          stopBatch();
          return;
        }
        const end = Math.min(i + SWEEP_BATCH_SIZE, sweep.length);
        for (; i < end; i++) send(sweep[i]);
        if (i >= sweep.length) stopBatch();
      }, SWEEP_BATCH_INTERVAL_MS);
    });

    socket.bind(0);
  });
}
