import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, LayoutChangeEvent, PanResponderGestureState } from 'react-native';
import { theme } from '../theme';

interface Props {
  /** Valor 0.0–1.0. */
  value: number;
  onChange: (v: number) => void;
  color?: string;
  /** Desenha um marcador no centro (útil para pan). */
  centerMark?: boolean;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** Slider horizontal por arraste, usado para o pan do send. */
export function HorizontalSlider({ value, onChange, color = theme.textDim, centerMark }: Props) {
  const [trackWidth, setTrackWidth] = useState(1);
  const startValue = useRef(value);

  const valueRef = useRef(value);
  const widthRef = useRef(trackWidth);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  widthRef.current = trackWidth;
  onChangeRef.current = onChange;

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValue.current = valueRef.current;
      },
      onPanResponderMove: (_e, g: PanResponderGestureState) => {
        const delta = g.dx / widthRef.current;
        onChangeRef.current(clamp01(startValue.current + delta));
      },
    }),
  ).current;

  const knobLeft = `${clamp01(value) * 100}%` as const;

  return (
    <View style={styles.track} onLayout={onLayout} {...responder.panHandlers}>
      {centerMark && <View style={styles.center} />}
      <View style={[styles.knob, { left: knobLeft, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 24,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    left: '50%',
    width: 1,
    top: 4,
    bottom: 4,
    backgroundColor: theme.border,
  },
  knob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
});
