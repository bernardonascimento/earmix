import { useCallback, useState } from 'react';
import * as Network from 'expo-network';
import { discoverMixers, DiscoveryDiag } from './X32Discovery';
import { DiscoveredMixer } from './discovery';

interface DiscoveryState {
  mixers: DiscoveredMixer[];
  scanning: boolean;
  error: string | null;
  /** Diagnóstico da última varredura (IP local, sub-rede, pacotes enviados). */
  diag: DiscoveryDiag | null;
  /** Retorna as mesas encontradas (vazio = não achou). */
  scan: () => Promise<DiscoveredMixer[]>;
}

/** IPv4 válido e não-loopback/link-local? (evita usar 127.x ou 169.254.x no sweep) */
function isUsableIpv4(ip: string | null): ip is string {
  if (!ip) return false;
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false;
  return !ip.startsWith('127.') && !ip.startsWith('169.254.');
}

/** Hook de descoberta de mesas: dispara broadcast + sweep e acumula respostas. */
export function useMixerDiscovery(): DiscoveryState {
  const [mixers, setMixers] = useState<DiscoveredMixer[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<DiscoveryDiag | null>(null);

  const scan = useCallback(async (): Promise<DiscoveredMixer[]> => {
    setScanning(true);
    setError(null);
    setMixers([]);
    setDiag(null);
    try {
      // Confirma a rede antes: sem Wi-Fi conectado, o sweep não tem sub-rede.
      const netState = await Network.getNetworkStateAsync().catch(() => null);
      const rawIp = await Network.getIpAddressAsync().catch(() => null);
      const localIp = isUsableIpv4(rawIp) ? rawIp : null;

      if (netState && netState.isConnected === false) {
        setError('Sem rede. Conecte o celular ao Wi-Fi da mesa.');
        return [];
      }
      if (!localIp) {
        setError('Não foi possível detectar o IP do celular na rede Wi-Fi.');
        return [];
      }

      const found = await discoverMixers({
        localIp,
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
