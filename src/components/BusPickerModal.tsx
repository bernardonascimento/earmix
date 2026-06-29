import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useMixerStore } from '../store/useMixerStore';
import { BottomSheet } from './BottomSheet';
import { theme, space, radius, font, family } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Sai da sessão (desconecta / encerra demo) e volta à seleção de mesa. */
  onExit: () => void;
}

/**
 * Seletor de retorno (fone) — exige toque deliberado, evitando que o músico
 * troque de bus sem querer durante o show.
 */
export function BusPickerModal({ visible, onClose, onExit }: Props) {
  const buses = useMixerStore((s) => s.buses);
  const selectedBus = useMixerStore((s) => s.selectedBus);
  const selectBus = useMixerStore((s) => s.selectBus);

  const pick = (bus: number) => {
    selectBus(bus);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Escolha o seu retorno" scrollable>
      <View style={styles.grid}>
        {buses.map((bus) => {
          const active = bus.index === selectedBus;
          return (
            <Pressable
              key={bus.index}
              onPress={() => pick(bus.index)}
              style={[styles.item, active && styles.itemActive]}
            >
              <Text style={[styles.itemName, active && styles.itemTextActive]} numberOfLines={1}>
                {bus.name}
              </Text>
              <Text style={[styles.itemSub, active && styles.itemSubActive]}>Bus {bus.index}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.exit} onPress={onExit}>
        <Text style={styles.exitText}>Sair / trocar mesa</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs },
  item: {
    width: '48%',
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  itemActive: { backgroundColor: theme.accentDim, borderColor: theme.accent },
  itemName: { color: theme.text, fontSize: font.label, fontWeight: '600' },
  itemSub: { color: theme.textFaint, fontSize: font.caption, marginTop: 3, fontFamily: family.monoRegular },
  itemSubActive: { color: theme.text },
  itemTextActive: { color: '#fff' },
  exit: {
    marginTop: space.lg,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  exitText: { color: theme.danger, fontWeight: '600', fontSize: font.label },
});
