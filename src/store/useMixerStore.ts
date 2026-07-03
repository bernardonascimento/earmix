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
/** Chave do modo admin (acesso ao Main LR / PA). */
const ADMIN_KEY = 'earmix.admin';

function persistAdmin(on: boolean) {
  AsyncStorage.setItem(ADMIN_KEY, on ? '1' : '0').catch(() => {});
}

/** Modo admin salvo (persistido — o admin fica lembrado entre sessões). */
export async function loadPersistedAdmin(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ADMIN_KEY)) === '1';
  } catch {
    return false;
  }
}

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
  /** Nível de meter suavizado (0.0–1.0): sobe na hora, desce suave (como o VU da mesa). */
  meter: number;
}

export interface BusState {
  index: number;
  name: string;
  /** Cor do bus na mesa (código 0–15 da X32). 0 = sem cor. */
  color: number;
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
  /** Bus de retorno ligado? false = o próprio fone mutado (não afeta a PA). */
  masterOn: boolean;

  /** Modo administrador: libera o Main LR (mix da PA). Persistido. */
  isAdmin: boolean;
  /** Estamos controlando o Main LR (PA) em vez de um bus de fone? */
  mainSelected: boolean;
  /** Nome/cor do Main LR na mesa. */
  main: { name: string; color: number };

  // ações de conexão
  connect: (host: string) => void;
  disconnect: () => void;
  /** Reabre o socket no host atual (troca de Wi-Fi / volta do background). No-op sem host ou em demo. */
  reconnect: () => void;
  /** Entra no modo demo (sem mesa) com dados fictícios e metering animado. */
  startDemo: () => void;

  // ação de seleção de bus
  selectBus: (bus: number) => void;
  /** Entra no modo Main LR (mix da PA). No-op se não for admin. */
  selectMain: () => void;
  /** Liga/desliga o modo admin (após validar a senha na tela inicial). */
  setAdmin: (on: boolean) => void;
  /** Pausa/retoma o fluxo de VU (chamado quando um modal abre/fecha). */
  pauseMeters: (paused: boolean) => void;

  // ações de mixagem (otimistas + envio à mesa)
  setLevel: (channel: number, level: number) => void;
  setPan: (channel: number, pan: number) => void;
  /** Liga/desliga o canal NO MEU fone (send on/off do bus selecionado). */
  toggleMute: (channel: number) => void;
  /** Define o volume master do retorno atual. */
  setMaster: (value: number) => void;
  /** Liga/desliga o bus de retorno inteiro (mute do próprio fone). */
  toggleMasterMute: () => void;

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
  }));
}

function defaultBuses(): BusState[] {
  return Array.from({ length: BUS_COUNT }, (_, i) => ({
    index: i + 1,
    name: `Bus ${i + 1}`,
    color: 0,
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
/** Envelope de "áudio" simulado por canal (0..1): sobe em transientes e decai. */
let demoEnv: Record<number, number> = {};
/**
 * Pausa o fluxo de VU (demo e real) enquanto um modal/bottom sheet está aberto. O VU
 * atualiza o store a ~20 Hz; abrir um sheet no meio disso disparava um loop de
 * re-render ("Maximum update depth"). Com o sheet aberto o VU nem aparece, então parar
 * o setState é seguro e mata o gatilho do crash. É uma flag simples (não-reativa).
 */
let metersPaused = false;

// Balística do VU: a mesa manda só o nível instantâneo a ~20 Hz. Sobe na hora,
// desce suave — sem peak-hold (nada de "prender" LED), igual ao medidor da mesa.
const METER_RELEASE = 0.78; // fator de decaimento por frame (queda natural, ~sem degrau)

function applyBallistics(prev: number, raw: number): number {
  return raw >= prev ? raw : prev * METER_RELEASE;
}

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

/**
 * Anima as barras de VU no demo com cara de áudio de verdade: cada canal mantém um
 * envelope que recebe "transientes" (picos) em ritmos diferentes e decai entre eles,
 * em vez de sortear um valor cheio a cada frame. Roda a 20 Hz como os meters reais.
 */
function startDemoMeters() {
  stopDemoMeters();
  demoEnv = {};
  demoMeterTimer = setInterval(() => {
    if (metersPaused) return; // sheet aberto: não atualiza o VU (evita loop de render)
    useMixerStore.setState((s) => ({
      channels: s.channels.map((c) => {
        const active = c.on && c.level > 0.02;
        let env = demoEnv[c.index] ?? 0;
        if (!active) {
          env *= 0.6; // sem sinal: cai rápido para o silêncio
        } else {
          // Ritmo de transientes varia por canal (uns "batem" mais que outros).
          const hitRate = 0.1 + ((c.index * 7) % 5) * 0.045;
          if (Math.random() < hitRate) {
            // Novo transiente proporcional ao fader, com dinâmica (às vezes forte).
            const hit = c.level * (0.5 + Math.random() * 0.55);
            env = Math.max(env, Math.min(1, hit));
          } else {
            env *= 0.86; // decaimento natural entre transientes
          }
        }
        demoEnv[c.index] = env;
        return { ...c, meter: Math.min(1, Math.max(0, env)) };
      }),
    }));
  }, 50);
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
  masterOn: true,
  isAdmin: false,
  mainSelected: false,
  main: { name: 'Main LR', color: 0 },

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
      })),
      // Cores variadas (1–7 da paleta X32) para o demo parecer uma mesa configurada.
      buses: DEMO_BUSES.map((name, i) => ({ index: i + 1, name, color: (i % 7) + 1 })),
    });
    loadDemoBus(bus);
    startDemoMeters();
  },

  selectBus: (bus) => {
    persistBus(bus); // lembra o bus do músico entre sessões
    if (get().demoMode) {
      saveDemoBus(get().selectedBus); // preserva o mix do bus anterior
      set({ selectedBus: bus, mainSelected: false });
      loadDemoBus(bus);
      return;
    }
    // Zera os sends locais (masterOn otimista ligado) e pede os valores reais do bus.
    set((s) => ({
      selectedBus: bus,
      mainSelected: false,
      masterOn: true,
      channels: s.channels.map((c) => ({ ...c, level: 0, pan: 0.5, on: true })),
    }));
    if (get().status === 'connected') x32.requestBusSends(bus);
  },

  selectMain: () => {
    if (!get().isAdmin) return;
    // Entra no mix da PA: zera local e pede os faders/mutes PRINCIPAIS + Main LR.
    set((s) => ({
      mainSelected: true,
      masterOn: true,
      channels: s.channels.map((c) => ({ ...c, level: 0, pan: 0.5, on: true })),
    }));
    if (get().status === 'connected') x32.requestMainSends();
  },

  pauseMeters: (paused) => {
    metersPaused = paused;
  },

  setAdmin: (on) => {
    persistAdmin(on);
    set({ isAdmin: on });
    // Perdeu o admin enquanto no Main LR: volta para o bus de fone.
    if (!on && get().mainSelected) get().selectBus(get().selectedBus);
  },

  setLevel: (channel, level) => {
    updateChannel(channel, { level });
    // No Main LR (admin): fader PRINCIPAL do canal (PA). Senão: send para o bus de fone.
    if (get().mainSelected) x32.setChannelFader(channel, level);
    else x32.setSendLevel(channel, get().selectedBus, level);
  },

  setPan: (channel, pan) => {
    updateChannel(channel, { pan });
    // No Main LR só mexemos em fader/mute; pan fica no send do bus de fone.
    if (!get().mainSelected) x32.setSendPan(channel, get().selectedBus, pan);
  },

  // "Mute" do canal. No fone (bus): liga/desliga o SEND (não afeta a PA). No Main LR
  // (admin): mute PRINCIPAL do canal — aí sim afeta a PA/todos.
  toggleMute: (channel) => {
    const ch = get().channels[channel - 1];
    const on = !ch.on;
    updateChannel(channel, { on });
    if (get().mainSelected) x32.setChannelOn(channel, on);
    else x32.setSendOn(channel, get().selectedBus, on);
  },

  setMaster: (value) => {
    set({ master: Math.min(1, Math.max(0, value)) });
    if (get().demoMode) return;
    if (get().mainSelected) x32.setMainFader(value);
    else x32.setBusMaster(get().selectedBus, value);
  },

  toggleMasterMute: () => {
    const on = !get().masterOn;
    set({ masterOn: on });
    if (get().demoMode) return;
    if (get().mainSelected) x32.setMainOn(on);
    else x32.setBusOn(get().selectedBus, on);
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
// Restaura o modo admin salvo (o admin fica lembrado entre sessões).
loadPersistedAdmin().then((admin) => {
  if (admin) useMixerStore.setState({ isAdmin: true });
});

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
    // Popular o estado inicial assim que conectar (também re-popula na reconexão).
    x32.requestBusNames();
    x32.requestChannelMeta();
    if (useMixerStore.getState().mainSelected) x32.requestMainSends();
    else x32.requestBusSends(useMixerStore.getState().selectedBus);
    x32.subscribeMeters();
  }
});

x32.onMessage((msg) => {
  const parsed = parseAddress(msg.address);
  const { selectedBus, mainSelected } = useMixerStore.getState();

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
      if (!mainSelected && parsed.channel && parsed.bus === selectedBus && v !== undefined)
        updateChannel(parsed.channel, { level: v });
      break;
    }
    case 'sendPan': {
      const v = firstNumber(msg);
      if (!mainSelected && parsed.channel && parsed.bus === selectedBus && v !== undefined)
        updateChannel(parsed.channel, { pan: v });
      break;
    }
    case 'sendOn': {
      const v = firstNumber(msg);
      if (!mainSelected && parsed.channel && parsed.bus === selectedBus && v !== undefined)
        updateChannel(parsed.channel, { on: v === 1 });
      break;
    }
    // Main LR (admin): fader/mute PRINCIPAL do canal chegam por esses endereços.
    case 'channelFader': {
      const v = firstNumber(msg);
      if (mainSelected && parsed.channel && v !== undefined) updateChannel(parsed.channel, { level: v });
      break;
    }
    case 'channelOn': {
      const v = firstNumber(msg);
      if (mainSelected && parsed.channel && v !== undefined) updateChannel(parsed.channel, { on: v === 1 });
      break;
    }
    case 'mainFader': {
      const v = firstNumber(msg);
      if (mainSelected && v !== undefined) useMixerStore.setState({ master: v });
      break;
    }
    case 'mainOn': {
      const v = firstNumber(msg);
      if (mainSelected && v !== undefined) useMixerStore.setState({ masterOn: v === 1 });
      break;
    }
    case 'mainName': {
      const name = firstString(msg);
      if (name !== undefined)
        useMixerStore.setState((s) => ({ main: { ...s.main, name: name.trim() || 'Main LR' } }));
      break;
    }
    case 'mainColor': {
      const color = firstNumber(msg);
      if (color !== undefined) useMixerStore.setState((s) => ({ main: { ...s.main, color } }));
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
    case 'busColor': {
      const color = firstNumber(msg);
      if (parsed.bus && color !== undefined)
        useMixerStore.setState((s) => ({
          buses: s.buses.map((b) => (b.index === parsed.bus ? { ...b, color } : b)),
        }));
      break;
    }
    case 'busFader': {
      const v = firstNumber(msg);
      if (parsed.bus === selectedBus && v !== undefined) useMixerStore.setState({ master: v });
      break;
    }
    case 'busOn': {
      const v = firstNumber(msg);
      if (parsed.bus === selectedBus && v !== undefined) useMixerStore.setState({ masterOn: v === 1 });
      break;
    }
    default:
      break;
  }
});

x32.onMeter((levels) => {
  if (metersPaused) return; // sheet aberto: não atualiza o VU (evita loop de render)
  useMixerStore.setState((s) => ({
    channels: s.channels.map((c) => {
      if (c.index > levels.length) return c;
      const raw = levels[c.index - 1] ?? 0;
      return { ...c, meter: applyBallistics(c.meter, raw) };
    }),
  }));
});
