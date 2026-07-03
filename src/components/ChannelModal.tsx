import React from 'react';
import { useMixerStore } from '../store/useMixerStore';
import { BottomSheet } from './BottomSheet';
import { LevelControl } from './LevelControl';
import { ModalActions } from './ModalActions';
import { theme, channelColor } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Índice 1-based do canal aberto, ou null quando fechado. */
  channelIndex: number | null;
}

/** Detalhe de um canal: volume no retorno atual + mute do canal no meu fone. */
export const ChannelModal = React.memo(function ChannelModal({ visible, onClose, channelIndex }: Props) {
  const channel = useMixerStore((s) => (channelIndex ? s.channels[channelIndex - 1] : undefined));
  const setLevel = useMixerStore((s) => s.setLevel);
  const toggleMute = useMixerStore((s) => s.toggleMute);

  if (!channel) return <BottomSheet visible={visible} onClose={onClose} children={null} />;

  const color = channel.on ? channelColor(channel.color) : theme.danger;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`${channel.name} · canal ${channel.index}`}>
      <LevelControl value={channel.level} onChange={(v) => setLevel(channel.index, v)} color={color} />

      <ModalActions
        on={channel.on}
        onToggleMute={() => toggleMute(channel.index)}
        onDone={onClose}
        muteLabel="Mutar canal"
      />
    </BottomSheet>
  );
});
