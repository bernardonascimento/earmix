import React from 'react';
import { useMixerStore } from '../store/useMixerStore';
import { BottomSheet } from './BottomSheet';
import { LevelControl } from './LevelControl';
import { ModalActions } from './ModalActions';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Volume master do retorno atual — ajustado raramente, por isso fica num bottom
 * sheet discreto acionado por um botão pequeno no cabeçalho. Traz também o mute do
 * bus inteiro (silencia o próprio fone, sem afetar a PA).
 */
export const MasterModal = React.memo(function MasterModal({ visible, onClose }: Props) {
  const master = useMixerStore((s) => s.master);
  const setMaster = useMixerStore((s) => s.setMaster);
  const masterOn = useMixerStore((s) => s.masterOn);
  const toggleMasterMute = useMixerStore((s) => s.toggleMasterMute);
  const buses = useMixerStore((s) => s.buses);
  const selectedBus = useMixerStore((s) => s.selectedBus);
  const busName = buses[selectedBus - 1]?.name ?? `Bus ${selectedBus}`;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Volume geral · ${busName}`}>
      <LevelControl value={master} onChange={setMaster} color={masterOn ? theme.accent : theme.danger} />
      <ModalActions on={masterOn} onToggleMute={toggleMasterMute} onDone={onClose} muteLabel="Mutar fone" />
    </BottomSheet>
  );
});
