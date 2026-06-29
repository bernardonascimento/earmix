import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { useMixerStore } from '../store/useMixerStore';
import { BottomSheet } from './BottomSheet';
import { LevelControl } from './LevelControl';
import { theme, space, radius, font, channelColor } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Índice 1-based do canal aberto, ou null quando fechado. */
  channelIndex: number | null;
}

/** Detalhe de um canal: volume no retorno atual. (Mute fica na faixa do canal.) */
export function ChannelModal({ visible, onClose, channelIndex }: Props) {
  const channel = useMixerStore((s) => (channelIndex ? s.channels[channelIndex - 1] : undefined));
  const setLevel = useMixerStore((s) => s.setLevel);

  if (!channel) return <BottomSheet visible={visible} onClose={onClose} children={null} />;

  const color = channelColor(channel.color);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`${channel.name} · canal ${channel.index}`}>
      <LevelControl value={channel.level} onChange={(v) => setLevel(channel.index, v)} color={color} />

      <Pressable style={styles.done} onPress={onClose}>
        <Text style={styles.doneText}>Pronto</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  done: {
    alignItems: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: theme.accent,
    marginTop: space.xl,
  },
  doneText: { color: '#03210F', fontWeight: '700', fontSize: font.body },
});
