import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { x32, ConnectionStatus } from '../x32/X32Client';
import { CHANNEL_COUNT, BUS_COUNT, parseAddress } from '../x32/addresses';
import { firstNumber, firstString } from '../osc/osc';
import { DEMO_CHANNELS, DEMO_BUSES, makeBusSends, DemoSend } from '../demo/demoData';

/** Chave do bus de retorno escolhido — persistido para reabrir no mesmo bus. */
const SELECTED_BUS_KEY = 'earmix.selectedBus';
/** Chave do IP da última mesa validada — para auto-reconectar ao reabrir o app. */
const HOST_KEY = 'earmix.host';

function persistBus(bus: number) {
  AsyncStorage.setItem(SELECTED_BUS_KEY, String(bus)).catch(() => {});
}

function persistHost(host: string) {
  AsyncStorage.setItem(HOST_KEY, host).catch(() => {});
}

function clearPersistedHost() {
  AsyncStorage.removeItem(HOST_KEY).catch(() => {});
}

/** IP da última mesa validada (ou null). Usado para auto-reconectar ao abrir. */
export async function loadPersistedHost(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(HOST_KEY);
  } catch {
    return null;
  }
}

/** Restaura o bus salvo no dispositivo (chamado uma vez na carga do módulo). */
export async function loadPersistedBus() {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_BUS_KEY);
    const bus = raw ? parseInt(raw, 10) : NaN;
    if (bus >= 1 && bus <= BUS_COUNT) useMixerStore.setState({ selectedBus: bus });
  } catch {
    /* ignore */
  }
}

export interface ChannelState {
  /** 1-based (1..32). */
  index: number;
  name: string;
  color: number;
  /** Send para o bus selecionado: nível 0.0–1.0. */
  level: number;
  /** Send para o bus selecionado: pan 0.0–1.0 (0.5 = centro). */
  pan: number;
  /** Send ligado para o bus selecionado (false = mutado NO MEU fone, não na PA). */
  on: boolean;
  /** Nível de meter suavizado (0.0–1.0), para a barra de VU (attack rápido, release lento). */
  meter: number;
  /** Pico segurado (0.0–1.0), para o "risquinho" de peak-hold do VU. */
  peak: number;
}

export interface BusState {
  index: number;
  name: string;
}

interface MixerState {
  status: ConnectionStatus;
  statusDetail?: string;
  host: string | null;
  /** Em modo demo não há mesa real: dados fictícios + metering simulado. */
  demoMode: boolean;

  channels: ChannelState[];
  buses: BusState[];
  selectedBus: number; // 1-based
  /** Volume master do bus de retorno selecionado (0.0–1.0). */
  master: number;

  // ações de conexão
  connect: (host: string) => void;
  disconnect: () => void;
  /** Reabre o socket no host atual (troca de Wi-Fi / volta do background). No-op sem host ou em demo. */
  reconnect: () => void;
  /** Entra no modo demo (sem mesa) com dados fictícios e metering animado. */
  startDemo: () => void;

  // ação de seleção de bus
  selectBus: (bus: number) => void;

  // ações de mixagem (otimistas + envio à mesa)
  setLevel: (channel: number, level: number) => void;
  setPan: (channel: number, pan: number) => void;
  /** Liga/desliga o canal NO MEU fone (send on/off do bus selecionado). */
  toggleMute: (channel: number) => void;
  /** Define o volume master do retorno atual. */
  setMaster: (value: number) => void;

  /** Aplica um snapshot de preset (level/pan/on por canal) ao bus atual. */
  applySnapshot: (snapshot: PresetSnapshot) => void;
  /** Captura o estado atual dos 32 canais como snapshot para salvar em preset. */
  captureSnapshot: () => PresetSnapshot;
}

/** Estado persistível de um canal dentro de um preset. */
export interface PresetChannel {
  level: number;
  pan: number;
  /** Send ligado para o bus (false = mutado no fone). */
  on: boolean;
}
export type PresetSnapshot = PresetChannel[]; // length = CHANNEL_COUNT

function defaultChannels(): ChannelState[] {
  return Array.from({ length: CHANNEL_COUNT }, (_, i) => ({
    index: i + 1,
    name: `Ch ${i + 1}`,
    color: 0,
    level: 0,
    pan: 0.5,
    on: true,
    meter: 0,
    peak: 0,
  }));
}

function defaultBuses(): BusState[] {
  return Array.from({ length: BUS_COUNT }, (_, i) => ({
    index: i + 1,
    name: `Bus ${i + 1}`,
  }));
}

function updateChannel(channel: number, patch: Partial<ChannelState>) {
  useMixerStore.setState((s) => ({
    channels: s.channels.map((c) => (c.index === channel ? { ...c, ...patch } : c)),
  }));
}

// ---- Estado interno do MODO DEMO (mix por bus + metering simulado) ----
let demoSends: Record<number, DemoSend[]> = {};
let demoMasters: Record<number, number> = {};
let demoMeterTimer: ReturnType<typeof setInterval> | null = null;

/** Carrega o mix fictício do bus indicado nos canais (preserva mute/nome/cor). */
function loadDemoBus(bus: number) {
  const sends = demoSends[bus];
  if (!sends) return;
  useMixerStore.setState((s) => ({
    master: demoMasters[bus] ?? 0.75,
    channels: s.channels.map((c, i) => ({
      ...c,
      level: sends[i]?.level ?? c.level,
      pan: sends[i]?.pan ?? c.pan,
      on: sends[i]?.on ?? c.on,
    })),
  }));
}

/** Salva o mix atual no bus indicado (para preservar ao trocar de bus). */
function saveDemoBus(bus: number) {
  const s = useMixerStore.getState();
  demoSends[bus] = s.channels.map((c) => ({ level: c.level, pan: c.pan, on: c.on }));
  demoMasters[bus] = s.master;
}

/** Anima as barras de VU de forma plausível enquanto o demo está ativo. */
function startDemoMeters() {
  stopDemoMeters();
  demoMeterTimer = setInterval(() => {
    useMixerStore.setState((s) => ({
      channels: s.channels.map((c) => {
        const active = c.on && c.level > 0.02;
        const target = active ? c.level * (0.45 + Math.random() * 0.6) - 0.05 : 0;
        const meter = Math.min(1, Math.max(0, target));
        return { ...c, meter, peak: meter >= c.peak ? meter : c.peak * 0.965 };
      }),
    }));
  }, 90);
}

function stopDemoMeters() {
  if (demoMeterTimer) {
    clearInterval(demoMeterTimer);
    demoMeterTimer = null;
  }
}

export const useMixerStore = create<MixerState>((set, get) => ({
  status: 'disconnected',
  host: null,
  demoMode: false,
  channels: defaultChannels(),
  buses: defaultBuses(),
  selectedBus: 1,
  master: 0.75,

  connect: (host) => {
    stopDemoMeters();
    set({ host, demoMode: false });
    x32.connect(host);
    // O estado inicial é pedido em onStatus -> 'connected' (abaixo).
    // O host só é PERSISTIDO quando o handshake valida (onStatus 'connected').
  },

  disconnect: () => {
    stopDemoMeters();
    x32.disconnect();
    // Saída manual / desistência: esquece a mesa para não auto-reconectar nela.
    clearPersistedHost();
    set({ demoMode: false, host: null });
  },

  reconnect: () => {
    const { host, demoMode } = get();
    if (demoMode || !host) return;
    stopDemoMeters();
    x32.connect(host);
  },

  startDemo: () => {
    demoSends = makeBusSends();
    demoMasters = {};
    const bus = get().selectedBus;
    set({
      demoMode: true,
      status: 'connected',
      statusDetail: 'demo',
      host: null,
      channels: DEMO_CHANNELS.map((c, i) => ({
        index: i + 1,
        name: c.name,
        color: c.color,
        level: 0,
        pan: 0.5,
        on: true,
        meter: 0,
        peak: 0,
      })),
      buses: DEMO_BUSES.map((name, i) => ({ index: i + 1, name })),
    });
    loadDemoBus(bus);
    startDemoMeters();
  },

  selectBus: (bus) => {
    persistBus(bus); // lembra o bus do músico entre sessões
    if (get().demoMode) {
      saveDemoBus(get().selectedBus); // preserva o mix do bus anterior
      set({ selectedBus: bus });
      loadDemoBus(bus);
      return;
    }
    set({ selectedBus: bus });
    // Zera os sends locais e pede os valores reais do novo bus.
    set((s) => ({
      channels: s.channels.map((c) => ({ ...c, level: 0, pan: 0.5, on: true })),
    }));
    if (get().status === 'connected') x32.requestBusSends(bus);
  },

  setLevel: (channel, level) => {
    updateChannel(channel, { level });
    x32.setSendLevel(channel, get().selectedBus, level);
  },

  setPan: (channel, pan) => {
    updateChannel(channel, { pan });
    x32.setSendPan(channel, get().selectedBus, pan);
  },

  // "Mute" no fone = liga/desliga o send do canal para o bus selecionado.
  // Não toca no mute principal do canal (não afeta a PA nem outros músicos).
  toggleMute: (channel) => {
    const ch = get().channels[channel - 1];
    const on = !ch.on;
    updateChannel(channel, { on });
    x32.setSendOn(channel, get().selectedBus, on);
  },

  setMaster: (value) => {
    set({ master: Math.min(1, Math.max(0, value)) });
    if (!get().demoMode) x32.setBusMaster(get().selectedBus, value);
  },

  applySnapshot: (snapshot) => {
    const bus = get().selectedBus;
    snapshot.forEach((pc, i) => {
      const channel = i + 1;
      updateChannel(channel, { level: pc.level, pan: pc.pan, on: pc.on });
      x32.setSendLevel(channel, bus, pc.level);
      x32.setSendPan(channel, bus, pc.pan);
      x32.setSendOn(channel, bus, pc.on);
    });
  },

  captureSnapshot: () =>
    get().channels.map((c) => ({ level: c.level, pan: c.pan, on: c.on })),
}));

// ---------------------------------------------------------------------------
// Ponte cliente X32 -> store. Registrada uma única vez na carga do módulo.
// ---------------------------------------------------------------------------

// Restaura o bus salvo assim que o app carrega (antes de conectar/entrar no demo).
loadPersistedBus();

x32.onStatus((status, detail) => {
  useMixerStore.setState({ status, statusDetail: detail });
  if (status === 'error') {
    // Handshake/socket falhou: esquece o host em memória para não reconectar
    // "fantasma" ao voltar do background. O IP salvo (validado) só some no disconnect.
    useMixerStore.setState({ host: null });
  }
  if (status === 'connected') {
    // Mesa validada: lembra o IP para auto-reconectar ao reabrir o app.
    const host = useMixerStore.getState().host;
    if (host) persistHost(host);
    // Popular o estado inicial assim que conectar (também re-popula o bus na reconexão).
    x32.requestBusNames();
    x32.requestChannelMeta();
    x32.requestBusSends(useMixerStore.getState().selectedBus);
    x32.subscribeMeters();
  }
});

x32.onMessage((msg) => {
  const parsed = parseAddress(msg.address);
  const selectedBus = useMixerStore.getState().selectedBus;

  switch (parsed.kind) {
    case 'channelName': {
      const name = firstString(msg);
      if (parsed.channel && name) updateChannel(parsed.channel, { name: name.trim() || `Ch ${parsed.channel}` });
      break;
    }
    case 'channelColor': {
      const color = firstNumber(msg);
      if (parsed.channel && color !== undefined) updateChannel(parsed.channel, { color });
      break;
    }
    case 'sendLevel': {
      const v = firstNumber(msg);
      if (parsed.channel && parsed.bus === selectedBus && v !== undefined)
        updateChannel(parsed.channel, { level: v });
      break;
    }
    case 'sendPan': {
      const v = firstNumber(msg);
      if (parsed.channel && parsed.bus === selectedBus && v !== undefined)
        updateChannel(parsed.channel, { pan: v });
      break;
    }
    case 'sendOn': {
      const v = firstNumber(msg);
      if (parsed.channel && parsed.bus === selectedBus && v !== undefined)
        updateChannel(parsed.channel, { on: v === 1 });
      break;
    }
    case 'busName': {
      const name = firstString(msg);
      if (parsed.bus && name !== undefined)
        useMixerStore.setState((s) => ({
          buses: s.buses.map((b) => (b.index === parsed.bus ? { ...b, name: name.trim() || `Bus ${parsed.bus}` } : b)),
        }));
      break;
    }
    case 'busFader': {
      const v = firstNumber(msg);
      if (parsed.bus === selectedBus && v !== undefined) useMixerStore.setState({ master: v });
      break;
    }
    default:
      break;
  }
});

// Balística do VU (a mesa manda só o nível instantâneo a ~20 Hz; o app oficial
// suaviza). Subida imediata; descida lenta; pico segurado e caindo bem devagar.
const METER_RELEASE = 0.80; // fator de decaimento do nível por frame
const PEAK_RELEASE = 0.965; // decaimento do peak-hold por frame (segura ~1s)

function applyBallistics(prev: number, raw: number, release: number): number {
  return raw >= prev ? raw : prev * release;
}

x32.onMeter((levels) => {
  useMixerStore.setState((s) => ({
    channels: s.channels.map((c) => {
      if (c.index > levels.length) return c;
      const raw = levels[c.index - 1] ?? 0;
      return {
        ...c,
        meter: applyBallistics(c.meter, raw, METER_RELEASE),
        peak: applyBallistics(c.peak, raw, PEAK_RELEASE),
      };
    }),
  }));
});
