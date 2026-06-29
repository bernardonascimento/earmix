import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../theme';

/** Nº de segmentos (LEDs) do VU. */
const SEGMENTS = 16;
const RED = theme.meterHot;
const YELLOW = '#FFD60A';
const GREEN = theme.meter;
/** Sufixo de alpha (~20%) para o LED apagado mostrar a cor da zona bem fraca. */
const OFF_ALPHA = '30';

/** Cor da zona conforme a posição (0 = base, 1 = topo). */
function zoneColor(ratio: number): string {
  if (ratio >= 0.82) return RED;
  if (ratio >= 0.55) return YELLOW;
  return GREEN;
}

/**
 * VU estilo LED: coluna de segmentos que acendem de baixo p/ cima.
 * Verde embaixo, amarelo no meio, vermelho no topo. `level` 0.0–1.0.
 */
export function Meter({ level }: { level: number }) {
  const v = Math.min(1, Math.max(0, level));
  const lit = Math.round(v * SEGMENTS);

  const segs = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const fromBottom = SEGMENTS - 1 - i; // i=0 é o topo
    const color = zoneColor(fromBottom / (SEGMENTS - 1));
    const on = fromBottom < lit;
    segs.push(
      <View key={i} style={[styles.seg, { backgroundColor: on ? color : color + OFF_ALPHA }]} />,
    );
  }

  return <View style={styles.track}>{segs}</View>;
}

const styles = StyleSheet.create({
  track: {
    width: 10,
    gap: 2,
    paddingVertical: 1,
  },
  seg: {
    flex: 1,
    borderRadius: 2,
    minHeight: 2,
  },
});
