import { useCallback, useState } from 'react';
import * as Network from 'expo-network';
import { discoverMixers, DiscoveryDiag } from './X32Discovery';
import { DiscoveredMixer, sweepTargets, prefix24 } from './discovery';
import { loadPersistedHost } from '../store/useMixerStore';

/** Sub-redes /24 domésticas/de palco mais comuns — último recurso quando não há
 *  NENHUMA pista do IP (ex.: iPad que não expõe o IP e nunca conectou por IP). */
const COMMON_SUBNETS = ['192.168.0', '192.168.1', '10.0.0'];

interface DiscoveryState {
  mixers: DiscoveredMixer[];
  scanning: boolean;
  error: string | null;
  /** Diagnóstico da última varredura (IP local, sub-rede, pacotes enviados). */
  diag: DiscoveryDiag | null;
  /** Busca mesas. `fallbackIp` (ex.: IP digitado) ajuda a achar a /24 se o IP local falhar. */
  scan: (fallbackIp?: string) => Promise<DiscoveredMixer[]>;
}

/** IPv4 utilizável? (rejeita 0.0.0.0 do expo, loopback 127.x e link-local 169.254.x) */
function isUsableIpv4(ip: string | null | undefined): ip is string {
  if (!ip) return false;
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false;
  return !ip.startsWith('127.') && !ip.startsWith('169.254.') && ip !== '0.0.0.0';
}

/** Hook de descoberta de mesas: dispara o sweep unicast e acumula respostas. */
export function useMixerDiscovery(): DiscoveryState {
  const [mixers, setMixers] = useState<DiscoveredMixer[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<DiscoveryDiag | null>(null);

  const scan = useCallback(async (fallbackIp?: string): Promise<DiscoveredMixer[]> => {
    setScanning(true);
    setError(null);
    setMixers([]);
    setDiag(null);
    try {
      const netState = await Network.getNetworkStateAsync().catch(() => null);
      const rawIp = await Network.getIpAddressAsync().catch(() => null);
      const localIp = isUsableIpv4(rawIp) ? rawIp : null;

      if (netState && netState.isConnected === false) {
        setError('Sem rede. Conecte o celular ao Wi-Fi da mesa.');
        return [];
      }

      // Sub-redes /24 a varrer. Preferimos as reveladas pelo IP local, pela última
      // mesa conectada e pelo IP digitado no campo. Se NADA disso existe (iPad que não
      // expõe o IP e nunca conectou), varremos as /24 domésticas mais comuns — assim a
      // busca funciona sem o usuário digitar nada. selfIp só é conhecido com IP real.
      const savedHost = await loadPersistedHost().catch(() => null);
      const prefixes: string[] = [];
      for (const ip of [localIp, savedHost, fallbackIp]) {
        const p = isUsableIpv4(ip) ? prefix24(ip) : null;
        if (p && !prefixes.includes(p)) prefixes.push(p);
      }
      const guessing = prefixes.length === 0;
      if (guessing) prefixes.push(...COMMON_SUBNETS);

      // Monta os alvos de todas as /24 candidatas (excluindo o próprio IP, se conhecido).
      const targets = prefixes.flatMap((p) => sweepTargets(`${p}.0`, localIp));
      if (targets.length === 0) {
        setError('Não achei a rede. Verifique se está no Wi-Fi da mesa.');
        return [];
      }

      const found = await discoverMixers({
        targets,
        selfIp: localIp,
        // Varrer várias /24 (chute) leva mais tempo; dá folga além do early-finish.
        timeoutMs: guessing ? 14000 : 9000,
        onFound: (m) => setMixers((prev) => (prev.some((p) => p.ip === m.ip) ? prev : [...prev, m])),
        onDiag: setDiag,
      });
      setMixers(found);
      return found;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na busca');
      return [];
    } finally {
      setScanning(false);
    }
  }, []);

  return { mixers, scanning, error, diag, scan };
}
