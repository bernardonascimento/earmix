/**
 * Conversão entre o valor de fader da X32 (float linear 0.0–1.0) e dB.
 *
 * A X32 usa uma "fader law" segmentada (documentada no protocolo OSC não-oficial):
 * o valor flutuante mapeia para faixas de dB com diferentes resoluções, dando mais
 * precisão perto do 0 dB. Faixa total: -∞ (em 0.0) até +10 dB (em 1.0).
 *
 *   float ≥ 0.5     ->  -10 .. +10 dB
 *   float ≥ 0.25    ->  -30 .. -10 dB
 *   float ≥ 0.0625  ->  -60 .. -30 dB
 *   float ≥ 0.0     ->  -90 .. -60 dB   (0.0 é tratado como -∞)
 */

export const FADER_MIN_DB = -90; // tratado como -∞ na UI
export const FADER_MAX_DB = 10;

/** Converte o float de fader da X32 (0.0–1.0) para dB. */
export function floatToDb(f: number): number {
  const x = Math.min(1, Math.max(0, f));
  if (x >= 0.5) return x * 40 - 30;
  if (x >= 0.25) return x * 80 - 50;
  if (x >= 0.0625) return x * 160 - 70;
  return x * 480 - 90;
}

/** Converte dB para o float de fader da X32 (0.0–1.0). */
export function dbToFloat(db: number): number {
  const d = Math.min(FADER_MAX_DB, Math.max(FADER_MIN_DB, db));
  let f: number;
  if (d >= -10) f = (d + 30) / 40;
  else if (d >= -30) f = (d + 50) / 80;
  else if (d >= -60) f = (d + 70) / 160;
  else f = (d + 90) / 480;
  return Math.min(1, Math.max(0, f));
}

/** Formata o dB para exibição (ex.: "-12.0 dB", "+3.5 dB", "-∞"). */
export function formatDb(db: number): string {
  if (db <= FADER_MIN_DB) return '-∞';
  const sign = db > 0 ? '+' : '';
  return `${sign}${db.toFixed(1)} dB`;
}

/** Conveniência: formata um float de fader (0–1) direto como rótulo em dB. */
export function formatFaderDb(f: number): string {
  return f <= 0 ? '-∞' : formatDb(floatToDb(f));
}
