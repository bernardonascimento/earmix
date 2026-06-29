import { floatToDb, dbToFloat, formatFaderDb } from './faderLaw';

describe('fader law X32', () => {
  it('mapeia pontos conhecidos float -> dB', () => {
    expect(floatToDb(1.0)).toBeCloseTo(10, 4);
    expect(floatToDb(0.75)).toBeCloseTo(0, 4); // 0 dB ~ 0.75
    expect(floatToDb(0.5)).toBeCloseTo(-10, 4);
    expect(floatToDb(0.25)).toBeCloseTo(-30, 4);
    expect(floatToDb(0.0625)).toBeCloseTo(-60, 4);
    expect(floatToDb(0.0)).toBeCloseTo(-90, 4);
  });

  it('dbToFloat é inverso de floatToDb', () => {
    for (const f of [0.05, 0.1, 0.25, 0.4, 0.5, 0.75, 0.9, 1.0]) {
      expect(dbToFloat(floatToDb(f))).toBeCloseTo(f, 4);
    }
  });

  it('faz clamp fora da faixa', () => {
    expect(floatToDb(2)).toBeCloseTo(10, 4);
    expect(floatToDb(-1)).toBeCloseTo(-90, 4);
    expect(dbToFloat(100)).toBe(1);
    expect(dbToFloat(-200)).toBe(0);
  });

  it('formata -∞ no fundo', () => {
    expect(formatFaderDb(0)).toBe('-∞');
    expect(formatFaderDb(0.75)).toMatch(/dB/);
  });
});
