// Mock do módulo nativo de UDP — o store importa o X32Client, que importa
// react-native-udp. No modo demo nada disso é usado, mas o import precisa resolver.
jest.mock('react-native-udp', () => ({
  __esModule: true,
  default: {
    createSocket: () => ({
      on() {},
      once() {},
      bind() {},
      send() {},
      close() {},
      setBroadcast() {},
    }),
  },
}));

// AsyncStorage em memória para testar persistência do bus.
const memStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn((k: string, v: string) => {
      memStore[k] = v;
      return Promise.resolve();
    }),
    getItem: jest.fn((k: string) => Promise.resolve(memStore[k] ?? null)),
    removeItem: jest.fn((k: string) => {
      delete memStore[k];
      return Promise.resolve();
    }),
  },
}));

import { useMixerStore, loadPersistedBus } from './useMixerStore';

describe('modo demo', () => {
  beforeEach(() => {
    jest.useFakeTimers(); // evita que o setInterval do metering rode de verdade
  });
  afterEach(() => {
    useMixerStore.getState().disconnect(); // para o timer do metering
    jest.useRealTimers();
  });

  it('startDemo popula canais e buses com dados fictícios e conecta', () => {
    useMixerStore.getState().startDemo();
    const s = useMixerStore.getState();
    expect(s.demoMode).toBe(true);
    expect(s.status).toBe('connected');
    expect(s.channels).toHaveLength(32);
    expect(s.channels[0].name).toBe('Kick');
    expect(s.channels[8].name).toBe('Bass');
    expect(s.buses[0].name).toBe('Fone Baterista');
  });

  it('cada bus tem um mix próprio, preservado ao alternar', () => {
    const { startDemo, setLevel, selectBus } = useMixerStore.getState();
    startDemo();
    selectBus(1);
    setLevel(1, 0.3); // ajusta o canal 1 no bus 1
    selectBus(2); // troca de bus (salva o bus 1)
    selectBus(1); // volta ao bus 1
    expect(useMixerStore.getState().channels[0].level).toBeCloseTo(0.3, 5);
  });

  it('toggleMute (mute no fone) desliga o send do canal e zera o VU', () => {
    const { startDemo, toggleMute } = useMixerStore.getState();
    startDemo();
    expect(useMixerStore.getState().channels[4].on).toBe(true);
    toggleMute(5); // tira o canal 5 do meu fone (send off)
    expect(useMixerStore.getState().channels[4].on).toBe(false);
    jest.advanceTimersByTime(200); // dispara o metering algumas vezes
    expect(useMixerStore.getState().channels[4].meter).toBe(0); // fora do fone não vaza VU
  });
});

describe('persistência do bus de retorno', () => {
  afterEach(() => {
    useMixerStore.setState({ selectedBus: 1 });
  });

  it('selectBus salva o bus escolhido no dispositivo', async () => {
    useMixerStore.getState().selectBus(8);
    const raw = await require('@react-native-async-storage/async-storage').default.getItem('earmix.selectedBus');
    expect(raw).toBe('8');
  });

  it('loadPersistedBus restaura o bus salvo ao abrir', async () => {
    await require('@react-native-async-storage/async-storage').default.setItem('earmix.selectedBus', '5');
    useMixerStore.setState({ selectedBus: 1 });
    await loadPersistedBus();
    expect(useMixerStore.getState().selectedBus).toBe(5);
  });

  it('loadPersistedBus ignora valores inválidos', async () => {
    await require('@react-native-async-storage/async-storage').default.setItem('earmix.selectedBus', '99');
    useMixerStore.setState({ selectedBus: 3 });
    await loadPersistedBus();
    expect(useMixerStore.getState().selectedBus).toBe(3);
  });
});
