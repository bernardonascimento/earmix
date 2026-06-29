import { useCallback, useState } from 'react';
import * as Network from 'expo-network';
import { discoverMixers } from './X32Discovery';
import { DiscoveredMixer } from './discovery';

interface DiscoveryState {
  mixers: DiscoveredMixer[];
  scanning: boolean;
  error: string | null;
  /** Retorna as mesas encontradas (vazio = não achou). */
  scan: () => Promise<DiscoveredMixer[]>;
}

/** Hook de descoberta de mesas: dispara o broadcast e acumula respostas. */
export function useMixerDiscovery(): DiscoveryState {
  const [mixers, setMixers] = useState<DiscoveredMixer[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (): Promise<DiscoveredMixer[]> => {
    setScanning(true);
    setError(null);
    setMixers([]);
    try {
      const localIp = await Network.getIpAddressAsync().catch(() => null);
      const found = await discoverMixers({
        localIp,
        onFound: (m) => setMixers((prev) => (prev.some((p) => p.ip === m.ip) ? prev : [...prev, m])),
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

  return { mixers, scanning, error, scan };
}
