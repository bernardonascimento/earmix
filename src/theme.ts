/** Tema escuro pensado para uso no palco (baixa luz, alto contraste). */
export const theme = {
  bg: '#0A0A0E',
  surface: '#16161D',
  surfaceAlt: '#20202A',
  border: '#2C2C38',
  text: '#F4F4F8',
  textDim: '#9A9AA6',
  textFaint: '#6A6A76',
  accent: '#34C759', // verde "fader"
  accentDim: '#1F6F3A',
  danger: '#FF453A',
  warning: '#FF9F0A',
  meter: '#30D158',
  meterHot: '#FF453A',
} as const;

/** Escala de espaçamento (múltiplos de 4) para consistência entre telas. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Raios de borda padronizados. */
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Escala tipográfica. */
export const font = {
  display: 40,
  title: 22,
  heading: 19,
  body: 16,
  label: 14,
  caption: 12,
  micro: 10,
} as const;

/**
 * Famílias tipográficas (carregadas em App.tsx via expo-font).
 * - display: Space Grotesk — marca, títulos e nome do retorno (personalidade)
 * - mono: Space Mono — TODOS os números (dB, nº de canal) com cara de leitor de console/LED
 * - sistema (SF) fica para corpo e labels (sem fontFamily explícito)
 */
export const family = {
  display: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  mono: 'SpaceMono_700Bold',
  monoRegular: 'SpaceMono_400Regular',
} as const;

/**
 * Paleta de cores de canal da X32 (valores 0–15).
 * 0–7 = cor sólida; 8–15 = versão "invertida" (fundo colorido) — aqui simplificamos
 * usando a mesma matiz. Retorna uma cor hex para a faixa do canal.
 */
const X32_COLORS = [
  '#3A3A44', // 0 OFF
  '#FF3B30', // 1 RD
  '#34C759', // 2 GN
  '#FFD60A', // 3 YE
  '#0A84FF', // 4 BL
  '#FF2D9B', // 5 MG (magenta/pink)
  '#64D2FF', // 6 CY
  '#F2F2F7', // 7 WH
];

export function channelColor(color: number): string {
  return X32_COLORS[color % 8] ?? X32_COLORS[0];
}
