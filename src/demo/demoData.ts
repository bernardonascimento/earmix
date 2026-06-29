/**
 * Dados fictícios para o MODO DEMO — permitem testar toda a UI (faders, mute, pan,
 * seleção de bus, presets, metering) sem uma mesa X32 conectada.
 *
 * Arquivo puro: não importa o store (evita ciclos de import).
 */

import { CHANNEL_COUNT, BUS_COUNT } from '../x32/addresses';

export interface DemoChannel {
  name: string;
  /** Cor no padrão X32 (1=RD 2=GN 3=YE 4=BL 5=MG 6=CY 7=WH). */
  color: number;
}

/** 32 canais típicos de uma banda/igreja. */
export const DEMO_CHANNELS: DemoChannel[] = [
  { name: 'Kick', color: 4 },
  { name: 'Snare', color: 4 },
  { name: 'Hi-Hat', color: 4 },
  { name: 'Tom 1', color: 4 },
  { name: 'Tom 2', color: 4 },
  { name: 'Floor Tom', color: 4 },
  { name: 'OH L', color: 4 },
  { name: 'OH R', color: 4 },
  { name: 'Bass', color: 2 },
  { name: 'Guitar 1', color: 1 },
  { name: 'Guitar 2', color: 1 },
  { name: 'Violão', color: 1 },
  { name: 'Keys L', color: 5 },
  { name: 'Keys R', color: 5 },
  { name: 'Synth', color: 5 },
  { name: 'Click', color: 6 },
  { name: 'Vox Lead', color: 3 },
  { name: 'Vox 1', color: 3 },
  { name: 'Vox 2', color: 3 },
  { name: 'Vox 3', color: 3 },
  { name: 'Vox 4', color: 3 },
  { name: 'Pastor', color: 7 },
  { name: 'Sax', color: 6 },
  { name: 'Trumpet', color: 6 },
  { name: 'Violino', color: 6 },
  { name: 'Perc', color: 4 },
  { name: 'Cajón', color: 4 },
  { name: 'Track L', color: 5 },
  { name: 'Track R', color: 5 },
  { name: 'Playback', color: 5 },
  { name: 'Ambience', color: 6 },
  { name: 'Talkback', color: 7 },
];

/** 16 buses de retorno (mixes de fone) com nomes de músicos/funções. */
export const DEMO_BUSES: string[] = [
  'Fone Baterista',
  'Fone Baixista',
  'Fone Guitarra',
  'Fone Teclado',
  'Fone Vocal 1',
  'Fone Vocal 2',
  'Fone Pastor',
  'Fone Sax',
  'Side Fill',
  'Wedge 1',
  'Wedge 2',
  'Fone Violão',
  'Fone Perc',
  'Fone MD',
  'Fone Extra 1',
  'Fone Extra 2',
];

export interface DemoSend {
  level: number;
  pan: number;
  on: boolean;
}

/**
 * Gera um mix inicial plausível e DIFERENTE para cada bus, de forma determinística
 * (sem aleatoriedade) — assim cada "fone" tem o próprio mix ao trocar de bus.
 * O músico daquele bus aparece com o próprio canal mais alto.
 */
export function makeBusSends(): Record<number, DemoSend[]> {
  const out: Record<number, DemoSend[]> = {};
  for (let bus = 1; bus <= BUS_COUNT; bus++) {
    const sends: DemoSend[] = [];
    for (let ch = 1; ch <= CHANNEL_COUNT; ch++) {
      // Base musical entre ~0.45 e ~0.8, variando suavemente por bus e canal.
      const wave = Math.sin(bus * 0.6 + ch * 0.45);
      let level = 0.62 + 0.16 * wave;
      // O canal "dono" do bus (mesma ordem) vem mais alto, como no monitor real.
      if (ch === bus) level = 0.9;
      const pan = 0.5 + 0.12 * Math.sin(ch * 0.9);
      sends.push({
        level: Math.min(1, Math.max(0, level)),
        pan: Math.min(1, Math.max(0, pan)),
        on: true,
      });
    }
    out[bus] = sends;
  }
  return out;
}
