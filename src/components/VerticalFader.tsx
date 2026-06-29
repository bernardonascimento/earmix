import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, LayoutChangeEvent, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { theme } from '../theme';

interface Props {
  /** Valor 0.0–1.0. */
  value: number;
  onChange: (v: number) => void;
  /** Cor do "preenchimento" do fader. */
  color?: string;
  width?: number;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/**
 * Fader vertical controlado por arraste. Arrastar para cima aumenta o nível.
 * Usa PanResponder (nativo) — sem dependências extras de gestos.
 */
export function VerticalFader({ value, onChange, color = theme.accent, width = 56 }: Props) {
  const [trackHeight, setTrackHeight] = useState(1);
  const startValue = useRef(value);

  const onLayout = (e: LayoutChangeEvent) => setTrackHeight(e.nativeEvent.layout.height);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValue.current = valueRef.current;
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        // dy positivo = arrasto para baixo => diminui o valor.
        const delta = -g.dy / heightRef.current;
        onChangeRef.current(clamp01(startValue.current + delta));
      },
    }),
  ).current;

  // refs para o PanResponder enxergar sempre os valores atuais sem recriar.
  const valueRef = useRef(value);
  const heightRef = useRef(trackHeight);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  heightRef.current = trackHeight;
  onChangeRef.current = onChange;

  const fillPct = `${clamp01(value) * 100}%` as const;

  return (
    <View style={[styles.track, { width }]} onLayout={onLayout} {...responder.panHandlers}>
      <View style={[styles.fill, { height: fillPct, backgroundColor: color }]} />
      {/* "Cabeça" do fader na posição atual */}
      <View style={[styles.knob, { bottom: fillPct }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    borderRadius: 6,
    opacity: 0.55,
  },
  knob: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 6,
    marginBottom: -3,
    borderRadius: 3,
    backgroundColor: theme.text,
  },
});
