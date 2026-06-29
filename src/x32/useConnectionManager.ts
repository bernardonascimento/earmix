import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import { useMixerStore } from '../store/useMixerStore';

/**
 * Mantém a conexão viva diante dos imprevistos de palco:
 *  - app volta do background (músico abriu outro app / bloqueou a tela)
 *  - troca de Wi-Fi (mudou o IP local -> o socket antigo morreu)
 *
 * Em qualquer um desses casos, se há uma mesa salva e não estamos em demo,
 * reabrimos o socket (store.reconnect). A validação por handshake continua valendo:
 * se a mesa não estiver mais na rede, a tela do Mixer desiste e volta para o início.
 *
 * Montado uma única vez no topo do app (App.tsx).
 */
export function useConnectionManager() {
  useEffect(() => {
    let lastIp: string | null = null;

    const reconnectIfNeeded = (force: boolean) => {
      const { host, demoMode, status, reconnect } = useMixerStore.getState();
      if (!host || demoMode) return;
      // Reabre o socket quando a conexão não está saudável OU quando algo mudou
      // de fato na rede (force) — ex.: IP local diferente após trocar de Wi-Fi.
      if (force || status !== 'connected') reconnect();
    };

    // Guarda o IP inicial para detectar trocas reais de rede depois.
    Network.getIpAddressAsync()
      .then((ip) => {
        lastIp = ip ?? null;
      })
      .catch(() => {});

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') reconnectIfNeeded(false);
    };

    const appSub = AppState.addEventListener('change', onAppState);

    let netSub: { remove: () => void } | undefined;
    try {
      netSub = Network.addNetworkStateListener(({ isConnected }) => {
        if (!isConnected) return; // perda de rede: o watchdog do cliente cuida
        // Rede voltou: confirma se o IP local mudou (troca de Wi-Fi) e força reconexão.
        Network.getIpAddressAsync()
          .then((ip) => {
            const changed = !!ip && !!lastIp && ip !== lastIp;
            lastIp = ip ?? lastIp;
            reconnectIfNeeded(changed);
          })
          .catch(() => reconnectIfNeeded(false));
      });
    } catch {
      /* listener indisponível em algum ambiente: AppState já cobre o essencial */
    }

    return () => {
      appSub.remove();
      netSub?.remove();
    };
  }, []);
}
