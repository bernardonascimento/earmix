import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { useMixerStore } from '../store/useMixerStore';
import { BottomSheet } from './BottomSheet';
import { LevelControl } from './LevelControl';
import { theme, space, radius, font } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Volume master do retorno atual — ajustado raramente, por isso fica num bottom
 * sheet discreto acionado por um botão pequeno no cabeçalho.
 */
export function MasterModal({ visible, onClose }: Props) {
  const master = useMixerStore((s) => s.master);
  const setMaster = useMixerStore((s) => s.setMaster);
  const buses = useMixerStore((s) => s.buses);
  const selectedBus = useMixerStore((s) => s.selectedBus);
  const busName = buses[selectedBus - 1]?.name ?? `Bus ${selectedBus}`;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Volume geral · ${busName}`}>
      <LevelControl value={master} onChange={setMaster} />
      <Pressable style={styles.done} onPress={onClose}>
        <Text style={styles.doneText}>Pronto</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  done: {
    marginTop: space.xl,
    alignItems: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: theme.accent,
  },
  doneText: { color: '#03210F', fontWeight: '700', fontSize: font.body },
});
