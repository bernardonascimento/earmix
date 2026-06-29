import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChannelState, useMixerStore } from '../store/useMixerStore';
import { VerticalFader } from './VerticalFader';
import { Meter } from './Meter';
import { formatFaderDb } from '../osc/faderLaw';
import { theme, space, radius, font, family, channelColor } from '../theme';

interface Props {
  channel: ChannelState;
  /** Abre o modal de detalhe do canal (volume/mute/pan). */
  onOpen: (channelIndex: number) => void;
  /** Celular deitado: faixas mais estreitas/altas, sem número, mute menor. */
  compact?: boolean;
}

/** Faixa de um canal: nome (toca p/ detalhe), VU, fader de send, dB e mute. */
export function ChannelStrip({ channel, onOpen, compact }: Props) {
  const setLevel = useMixerStore((s) => s.setLevel);
  const toggleMute = useMixerStore((s) => s.toggleMute);

  const color = channelColor(channel.color);

  return (
    <View style={[styles.strip, compact && styles.stripCompact]}>
      <View style={[styles.colorBar, { backgroundColor: color }]} />

      {/* Cabeçalho tocável → abre o modal do canal */}
      <Pressable style={styles.head} onPress={() => onOpen(channel.index)} hitSlop={4}>
        <Text numberOfLines={1} style={[styles.name, compact && styles.nameCompact]}>
          {channel.name}
        </Text>
        {/* Número do canal — oculto no celular deitado p/ ganhar altura */}
        {!compact && (
          <View style={styles.numBadge}>
            <Text style={styles.num}>{channel.index}</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.faderRow}>
        <Meter level={channel.on ? channel.meter : 0} />
        <VerticalFader value={channel.level} onChange={(v) => setLevel(channel.index, v)} color={color} />
      </View>

      <Text style={styles.db}>{formatFaderDb(channel.level)}</Text>

      <Pressable
        onPress={() => toggleMute(channel.index)}
        style={[styles.mute, compact && styles.muteCompact, !channel.on && styles.muteActive]}
      >
        <Text style={[styles.muteText, compact && styles.muteTextCompact, !channel.on && styles.muteTextActive]}>
          {channel.on ? 'ON' : 'MUTE'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    width: 96,
    height: '100%',
    backgroundColor: theme.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: space.sm,
    marginRight: space.sm,
    alignItems: 'center',
  },
  // Celular deitado: mais estreito e menos padding (faders mais altos, cabe mais).
  stripCompact: {
    width: 66,
    borderRadius: radius.md,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
    marginRight: space.xs,
  },
  colorBar: {
    height: 4,
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    marginBottom: space.sm,
  },
  head: { alignItems: 'center', alignSelf: 'stretch', marginBottom: space.sm },
  name: {
    color: theme.text,
    fontSize: font.label,
    fontFamily: family.displaySemi,
    maxWidth: '100%',
  },
  nameCompact: { fontSize: font.caption },
  numBadge: {
    marginTop: space.xs,
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: theme.surfaceAlt,
    alignItems: 'center',
  },
  num: { color: theme.textDim, fontSize: font.caption, fontFamily: family.mono },
  faderRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.xs,
    flex: 1,
    minHeight: 120,
    marginBottom: space.sm,
  },
  db: {
    color: theme.textDim,
    fontSize: font.caption,
    marginBottom: space.sm,
    fontFamily: family.monoRegular,
  },
  mute: {
    alignSelf: 'stretch',
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  muteCompact: { paddingVertical: space.xs, borderRadius: radius.sm },
  muteActive: {
    backgroundColor: theme.danger,
    borderColor: theme.danger,
  },
  muteText: {
    color: theme.textDim,
    fontWeight: '700',
    fontSize: font.caption,
  },
  muteTextCompact: { fontSize: font.micro },
  muteTextActive: {
    color: '#fff',
  },
});
