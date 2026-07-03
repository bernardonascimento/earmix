import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, space, radius, font } from '../theme';

interface Props {
  /** Alvo ligado? false = mutado (botão fica vermelho). */
  on: boolean;
  onToggleMute: () => void;
  onDone: () => void;
  /** Texto do botão quando está ligado (ex.: "Mutar fone", "Mutar canal"). */
  muteLabel: string;
}

/**
 * Rodapé de ação compartilhado pelos modais de volume: botão de MUTE à esquerda
 * (vermelho quando mutado) e "Pronto" à direita. Mutar aqui afeta só o fone do
 * músico (send do canal ou bus de retorno), nunca a PA.
 */
export function ModalActions({ on, onToggleMute, onDone, muteLabel }: Props) {
  return (
    <View style={styles.row}>
      <Pressable style={[styles.mute, !on && styles.muteActive]} onPress={onToggleMute}>
        <Ionicons
          name={on ? 'volume-high' : 'volume-mute'}
          size={20}
          color={on ? theme.text : '#fff'}
        />
        <Text style={[styles.muteText, !on && styles.muteTextActive]}>{on ? muteLabel : 'Mutado'}</Text>
      </Pressable>

      <Pressable style={styles.done} onPress={onDone}>
        <Text style={styles.doneText}>Pronto</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  mute: {
    flex: 1, // metade fixa da largura — não encolhe/cresce com o texto ("Mutado" vs "Mutar fone")
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceAlt,
  },
  muteActive: { backgroundColor: theme.danger, borderColor: theme.danger },
  muteText: { color: theme.text, fontWeight: '700', fontSize: font.body },
  muteTextActive: { color: '#fff' },
  done: {
    flex: 1, // outra metade
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: theme.accent,
  },
  doneText: { color: '#03210F', fontWeight: '700', fontSize: font.body },
});
