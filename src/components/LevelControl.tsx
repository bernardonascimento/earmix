import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { HorizontalSlider } from './HorizontalSlider';
import { formatFaderDb } from '../osc/faderLaw';
import { theme, space, radius, font, family } from '../theme';

interface Props {
  value: number;
  onChange: (v: number) => void;
  color?: string;
  /** Passo dos botões −/+ (fração de 0..1). */
  step?: number;
}

/** Controle de nível reutilizável: dB grande + slider + botões −/+. */
export function LevelControl({ value, onChange, color = theme.accent, step = 0.02 }: Props) {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return (
    <View>
      <Text style={[styles.db, { color }]}>{formatFaderDb(value)}</Text>
      <HorizontalSlider value={value} onChange={onChange} color={color} />
      <View style={styles.row}>
        <Pressable style={styles.step} onPress={() => onChange(clamp(value - step))} hitSlop={6}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Pressable style={styles.step} onPress={() => onChange(clamp(value + step))} hitSlop={6}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  db: {
    fontSize: 34,
    fontFamily: family.mono,
    marginTop: space.sm,
    marginBottom: space.lg,
    letterSpacing: -1,
  },
  row: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  step: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  stepText: { color: theme.text, fontSize: font.title, fontWeight: '700' },
});
