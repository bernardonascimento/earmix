import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMixerStore } from '../store/useMixerStore';
import { ChannelStrip } from '../components/ChannelStrip';
import { BusPickerModal } from '../components/BusPickerModal';
import { MasterModal } from '../components/MasterModal';
import { ChannelModal } from '../components/ChannelModal';
import { formatFaderDb } from '../osc/faderLaw';
import { theme, space, radius, font, family } from '../theme';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Mixer'>;

const STATUS_COLOR: Record<string, string> = {
  connected: theme.accent,
  connecting: theme.warning,
  error: theme.danger,
  disconnected: theme.textDim,
};

/** Tempo sem reconectar antes de desistir e voltar para a tela inicial. */
const GIVEUP_MS = 15000;

export function MixerScreen({ navigation }: Props) {
  useKeepAwake(); // não deixa a tela apagar durante o show

  const channels = useMixerStore((s) => s.channels);
  const status = useMixerStore((s) => s.status);
  const demoMode = useMixerStore((s) => s.demoMode);
  const buses = useMixerStore((s) => s.buses);
  const selectedBus = useMixerStore((s) => s.selectedBus);
  const master = useMixerStore((s) => s.master);
  const disconnect = useMixerStore((s) => s.disconnect);

  const [busPickerOpen, setBusPickerOpen] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState<number | null>(null);

  // Modo compacto: SÓ celular deitado. Tablet (menor lado ≥ 600dp) mantém o normal.
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 600;
  const compact = width > height && !isTablet;

  const busName = buses[selectedBus - 1]?.name ?? `Bus ${selectedBus}`;
  const stateLabel = demoMode ? 'modo demo' : status === 'connected' ? 'ao vivo' : status;

  const onExit = () => {
    setBusPickerOpen(false);
    disconnect();
    navigation.navigate('Connect');
  };

  // Conexão real perdida: mostra overlay de reconexão e, se não voltar a tempo,
  // desiste e retorna para a tela inicial (o store.disconnect esquece a mesa).
  const reconnecting = !demoMode && status !== 'connected';
  useEffect(() => {
    if (!reconnecting) return;
    const timer = setTimeout(() => {
      disconnect();
      navigation.navigate('Connect');
    }, GIVEUP_MS);
    return () => clearTimeout(timer);
  }, [reconnecting, disconnect, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        {/* Título = seletor de retorno (toque deliberado, evita troca acidental) */}
        <View style={styles.headerLeft}>
          <Pressable style={styles.busButton} onPress={() => setBusPickerOpen(true)} hitSlop={8}>
            <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
            <Text style={styles.busButtonText} numberOfLines={1}>
              {busName}
            </Text>
            <Ionicons name="chevron-down" size={18} color={theme.accent} style={styles.caret} />
          </Pressable>
          {/* Subtítulo ocupa altura — escondido no celular deitado */}
          {!compact && <Text style={styles.subtitle}>Mix de fone · {stateLabel}</Text>}
        </View>

        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn} onPress={() => setMasterOpen(true)}>
            <Ionicons name="volume-high" size={20} color={theme.text} />
            <Text style={styles.iconBtnSub}>{formatFaderDb(master)}</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Presets')}>
            <Ionicons name="albums-outline" size={20} color={theme.text} />
            <Text style={styles.iconBtnLabel}>Presets</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        style={styles.scroll}
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.strips}
      >
        {channels.map((ch) => (
          <ChannelStrip key={ch.index} channel={ch} onOpen={setChannelOpen} compact={compact} />
        ))}
      </ScrollView>

      <BusPickerModal visible={busPickerOpen} onClose={() => setBusPickerOpen(false)} onExit={onExit} />
      <MasterModal visible={masterOpen} onClose={() => setMasterOpen(false)} />
      <ChannelModal visible={channelOpen !== null} channelIndex={channelOpen} onClose={() => setChannelOpen(null)} />

      {reconnecting && (
        <View style={styles.overlay} pointerEvents="auto">
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={styles.overlayTitle}>
            {status === 'error' ? 'Mesa fora de alcance' : 'Reconectando à mesa…'}
          </Text>
          <Text style={styles.overlaySub}>Verifique se está no Wi-Fi da mesa</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.sm,
  },
  headerCompact: { alignItems: 'center', paddingTop: space.xs, paddingBottom: space.xs },
  headerLeft: { flexShrink: 1 },
  busButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dot: { width: 11, height: 11, borderRadius: radius.pill },
  busButtonText: { color: theme.text, fontSize: font.heading, fontFamily: family.display, flexShrink: 1, letterSpacing: -0.3 },
  caret: { marginLeft: -2 },
  subtitle: { color: theme.textFaint, fontSize: font.caption, marginTop: space.sm, marginLeft: space.xs },
  headerRight: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 62,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  iconBtnSub: { color: theme.textDim, fontSize: font.micro, fontFamily: family.monoRegular, marginTop: 2 },
  iconBtnLabel: { color: theme.textDim, fontSize: font.micro, fontWeight: '600', marginTop: 2 },
  scroll: { flex: 1 },
  strips: {
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.md,
    alignItems: 'stretch', // estica as faixas para toda a altura disponível
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  overlayTitle: { color: theme.text, fontSize: font.heading, fontFamily: family.display },
  overlaySub: { color: theme.textDim, fontSize: font.caption },
});
