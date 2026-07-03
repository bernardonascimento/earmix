import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useMixerStore } from '../store/useMixerStore';
import { BottomSheet } from './BottomSheet';
import { theme, space, radius, font, family, channelColor } from '../theme';

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
export const BusPickerModal = React.memo(function BusPickerModal({ visible, onClose, onExit }: Props) {
  const buses = useMixerStore((s) => s.buses);
  const selectedBus = useMixerStore((s) => s.selectedBus);
  const selectBus = useMixerStore((s) => s.selectBus);
  const isAdmin = useMixerStore((s) => s.isAdmin);
  const mainSelected = useMixerStore((s) => s.mainSelected);
  const main = useMixerStore((s) => s.main);
  const selectMain = useMixerStore((s) => s.selectMain);

  const pick = (bus: number) => {
    selectBus(bus);
    onClose();
  };

  const pickMain = () => {
    selectMain();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Escolha o seu retorno" scrollable>
      {/* Só admin: mix da casa (PA). Fica em destaque no topo. */}
      {isAdmin && (
        <Pressable
          onPress={pickMain}
          style={[styles.mainItem, mainSelected && styles.mainItemActive]}
        >
          <View style={styles.itemHeader}>
            <View style={[styles.dot, { backgroundColor: channelColor(main.color) }]} />
            <Text style={styles.itemName} numberOfLines={1}>{main.name || 'Main LR'}</Text>
          </View>
          <Text style={styles.mainSub}>Mix da casa · PA {mainSelected ? '· ativo' : ''}</Text>
        </Pressable>
      )}

      <View style={styles.grid}>
        {buses.map((bus) => {
          const active = !mainSelected && bus.index === selectedBus;
          return (
            <Pressable
              key={bus.index}
              onPress={() => pick(bus.index)}
              style={[styles.item, active && styles.itemActive]}
            >
              <View style={styles.itemHeader}>
                <View style={[styles.dot, { backgroundColor: channelColor(bus.color) }]} />
                <Text style={[styles.itemName, active && styles.itemTextActive]} numberOfLines={1}>
                  {bus.name}
                </Text>
              </View>
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
});

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs },
  mainItem: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.warning,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    marginBottom: space.md,
  },
  mainItemActive: { backgroundColor: theme.accentDim, borderColor: theme.accent },
  mainSub: { color: theme.warning, fontSize: font.caption, marginTop: 3, fontWeight: '600' },
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
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  itemName: { color: theme.text, fontSize: font.label, fontWeight: '600', flexShrink: 1 },
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
