import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PresetSnapshot } from '../store/useMixerStore';

const STORAGE_KEY = 'earmix.presets.v1';

export interface Preset {
  id: string;
  /** Nome livre, ex.: "João - Guitarra". */
  name: string;
  /** Bus de retorno em que o preset foi capturado (dica para o usuário). */
  bus: number;
  /** Snapshot dos 32 canais (level/pan/on do send no bus). */
  snapshot: PresetSnapshot;
  /** Volume master do retorno (0.0–1.0). Opcional p/ presets antigos. */
  master?: number;
  /** Timestamp ISO de criação (passado de fora — sem Date.now no core). */
  createdAt: string;
}

interface PresetState {
  presets: Preset[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (preset: Omit<Preset, 'id'> & { id?: string }) => Promise<Preset>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
}

async function persist(presets: Preset[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/** Gera um id simples sem depender de Math.random/Date no core do app. */
function makeId(name: string, createdAt: string): string {
  return `${createdAt}-${name.replace(/\s+/g, '_').slice(0, 24)}`;
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const presets: Preset[] = raw ? JSON.parse(raw) : [];
      set({ presets, loaded: true });
    } catch {
      set({ presets: [], loaded: true });
    }
  },

  save: async (input) => {
    const id = input.id ?? makeId(input.name, input.createdAt);
    const preset: Preset = { ...input, id };
    const existing = get().presets;
    const next = existing.some((p) => p.id === id)
      ? existing.map((p) => (p.id === id ? preset : p))
      : [preset, ...existing];
    set({ presets: next });
    await persist(next);
    return preset;
  },

  remove: async (id) => {
    const next = get().presets.filter((p) => p.id !== id);
    set({ presets: next });
    await persist(next);
  },

  rename: async (id, name) => {
    const next = get().presets.map((p) => (p.id === id ? { ...p, name } : p));
    set({ presets: next });
    await persist(next);
  },
}));
