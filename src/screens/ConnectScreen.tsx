import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMixerStore, loadPersistedHost } from '../store/useMixerStore';
import { useMixerDiscovery } from '../x32/useMixerDiscovery';
import { PasswordPrompt } from '../components/PasswordPrompt';
import { DiscoveredMixer } from '../x32/discovery';
import { theme, space, radius, font, family } from '../theme';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Connect'>;

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
/**
 * Senha do modo admin (libera o Main LR / PA). É um controle de acesso CASUAL — fica
 * no bundle, não é criptográfico. Troque aqui o valor conforme combinar com o time.
 */
const ADMIN_PASSWORD = 'monitor@admin';

export function ConnectScreen({ navigation }: Props) {
  const [host, setHost] = useState('192.168.0.'); // prefixo comum; o usuário completa
  const connect = useMixerStore((s) => s.connect);
  const startDemo = useMixerStore((s) => s.startDemo);
  const status = useMixerStore((s) => s.status);
  const detail = useMixerStore((s) => s.statusDetail);

  const { mixers, scanning, error: scanError, scan } = useMixerDiscovery();

  const isAdmin = useMixerStore((s) => s.isAdmin);
  const setAdmin = useMixerStore((s) => s.setAdmin);

  // Em telas largas (iPad) dá margem lateral generosa para os botões não esticarem.
  const { width } = useWindowDimensions();
  const sidePad = width >= 700 ? Math.min(width * 0.2, 240) : space.xl;

  // iOS tem prompt nativo (Alert.prompt); Android não → usamos um modal próprio só nele.
  const [adminPrompt, setAdminPrompt] = useState(false);
  const onAdminTap = () => {
    if (isAdmin) {
      Alert.alert('Modo admin', 'Sair do modo admin?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => setAdmin(false) },
      ]);
      return;
    }
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Modo admin',
        'Digite a senha para liberar o Main LR (mix da casa).',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Entrar', onPress: (senha?: string) => onAdminSubmit(senha ?? '') },
        ],
        'secure-text',
      );
    } else {
      setAdminPrompt(true);
    }
  };

  const onAdminSubmit = (senha: string) => {
    setAdminPrompt(false);
    if (senha === ADMIN_PASSWORD) setAdmin(true);
    else Alert.alert('Senha incorreta');
  };

  // Há uma tentativa de conexão em andamento aguardando validação (handshake).
  // Só navegamos para o Mixer quando a mesa é confirmada; erro mantém na tela.
  const [connecting, setConnecting] = useState(false);
  // Distingue a reconexão automática (ao abrir) da conexão manual, só p/ a mensagem.
  const [autoReconnecting, setAutoReconnecting] = useState(false);

  const onScan = async () => {
    // Passa o IP do campo como pista da sub-rede caso o iPad não exponha o IP local.
    await scan(host.trim());
  };

  const valid = IP_RE.test(host.trim());

  // Dispara a conexão e aguarda o handshake validar (ver useEffect abaixo).
  const connectTo = (ip: string) => {
    setConnecting(true);
    connect(ip);
  };

  const onDemo = () => {
    startDemo();
    navigation.navigate('Mixer');
  };

  const onConnect = () => {
    if (!valid) return;
    connectTo(host.trim());
  };

  const onPickMixer = (mixer: DiscoveredMixer) => {
    setHost(mixer.ip);
    connectTo(mixer.ip);
  };

  // Auto-reconexão ao ABRIR o app: se há uma mesa salva, tenta voltar a ela.
  // Roda uma única vez na montagem (a tela é a raiz da navegação).
  const triedAutoReconnect = useRef(false);
  useEffect(() => {
    if (triedAutoReconnect.current) return;
    triedAutoReconnect.current = true;
    loadPersistedHost().then((saved) => {
      if (saved) {
        setHost(saved);
        setAutoReconnecting(true);
        connectTo(saved);
      }
    });
  }, []);

  // Gating de navegação: só entra no Mixer quando o handshake confirma a mesa.
  useEffect(() => {
    if (!connecting) return;
    if (status === 'connected') {
      setConnecting(false);
      setAutoReconnecting(false);
      navigation.navigate('Mixer');
    } else if (status === 'error' || status === 'disconnected') {
      setConnecting(false);
      setAutoReconnecting(false);
    }
  }, [connecting, status, navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingHorizontal: sidePad }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.hero}>
          <Image source={require('../../assets/logo.png')} style={styles.logoMark} resizeMode="contain" />
          <Text style={styles.logo}>EarMix</Text>
          <Text style={styles.tagline}>Seu mix de fone, na palma da mão</Text>
        </View>

        <Text style={styles.label}>IP da mesa (Behringer X32 / Midas M32)</Text>
        <TextInput
          value={host}
          onChangeText={setHost}
          placeholder="192.168.0.10"
          placeholderTextColor={theme.textDim}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          onSubmitEditing={onConnect}
        />
        <Text style={styles.hint}>Porta 10023 · conecte o celular na mesma rede Wi-Fi da mesa</Text>

        <Pressable
          onPress={onConnect}
          disabled={!valid || connecting}
          style={[styles.button, (!valid || connecting) && styles.buttonDisabled]}
        >
          {connecting ? (
            <View style={styles.buttonRow}>
              <ActivityIndicator color="#03210F" />
              <Text style={styles.buttonText}>
                {autoReconnecting ? 'Reconectando à mesa…' : 'Conectando…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Conectar</Text>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.line} />
        </View>

        <Pressable onPress={onScan} disabled={scanning || connecting} style={styles.scanButton}>
          {scanning ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <>
              <Ionicons name="search" size={18} color={theme.text} />
              <Text style={styles.scanButtonText}>Buscar mesas na rede</Text>
            </>
          )}
        </Pressable>

        {scanError && <Text style={styles.error}>{scanError}</Text>}

        {!scanning && mixers.length === 0 && scanError === null && (
          <Text style={styles.hint}>Toque em buscar para encontrar mesas automaticamente.</Text>
        )}

        {mixers.map((mixer) => (
          <Pressable key={mixer.ip} onPress={() => onPickMixer(mixer)} style={styles.mixerCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mixerName}>{mixer.name || 'Mesa'}</Text>
              <Text style={styles.mixerMeta}>
                {mixer.ip}
                {mixer.model ? ` · ${mixer.model}` : ''}
                {mixer.firmware ? ` · v${mixer.firmware}` : ''}
              </Text>
            </View>
            <Text style={styles.mixerArrow}>›</Text>
          </Pressable>
        ))}

        {status === 'error' && !connecting && (
          <Text style={styles.error}>{detail || 'Não foi possível conectar à mesa'}</Text>
        )}
        {status === 'connected' && !connecting && (
          <Text style={styles.status}>Conectado ✓ {detail ? `· ${detail}` : ''}</Text>
        )}

          <View style={styles.bottomRow}>
            <Pressable onPress={onDemo} style={[styles.bottomBtn, styles.bottomBtnDisabled]}>
              <Ionicons name="headset-outline" size={18} color={theme.textFaint} />
              <Text style={[styles.bottomBtnText, styles.bottomBtnTextDim]}>Modo demo</Text>
            </Pressable>

            <Pressable
              onPress={onAdminTap}
              style={[styles.bottomBtn, isAdmin ? styles.adminBtnOn : styles.bottomBtnDisabled]}
            >
              <Ionicons
                name={isAdmin ? 'lock-open' : 'lock-closed'}
                size={18}
                color={isAdmin ? theme.accent : theme.textFaint}
              />
              <Text style={[styles.bottomBtnText, isAdmin ? styles.adminBtnTextOn : styles.bottomBtnTextDim]}>
                {isAdmin ? 'Admin' : 'Modo admin'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Prompt de senha do admin no Android (no iOS usamos o Alert.prompt nativo). */}
      <PasswordPrompt
        visible={adminPrompt}
        message="Digite a senha para liberar o Main LR (mix da casa)."
        onCancel={() => setAdminPrompt(false)}
        onSubmit={onAdminSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },
  hero: { alignItems: 'center', marginBottom: space.xxl + space.lg },
  logoMark: { width: 80, height: 80, marginBottom: space.xs },
  logo: { color: theme.text, fontSize: font.display, fontFamily: family.display, letterSpacing: -1.5 },
  tagline: { color: theme.textDim, fontSize: font.body, marginTop: space.xs },
  label: { color: theme.text, fontSize: font.label, fontWeight: '600', marginBottom: space.sm },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    color: theme.text,
    fontSize: font.heading,
    fontFamily: family.monoRegular,
  },
  hint: { color: theme.textFaint, fontSize: font.caption, marginTop: space.sm, lineHeight: 18 },
  button: {
    backgroundColor: theme.accent,
    borderRadius: radius.md,
    paddingVertical: space.lg + 2,
    alignItems: 'center',
    marginTop: space.xl,
  },
  buttonDisabled: { backgroundColor: theme.accentDim, opacity: 0.6 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonText: { color: '#03210F', fontSize: font.body, fontWeight: '700' },
  status: { color: theme.textDim, textAlign: 'center', marginTop: space.lg },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xl },
  line: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { color: theme.textFaint, fontSize: font.caption },
  scanButton: {
    flexDirection: 'row',
    gap: space.sm,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  scanButtonText: { color: theme.text, fontSize: font.body, fontWeight: '600' },
  error: { color: theme.danger, textAlign: 'center', marginTop: space.md },
  mixerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: radius.md,
    padding: space.lg,
    marginTop: space.md,
  },
  mixerName: { color: theme.text, fontSize: font.body, fontWeight: '600' },
  mixerMeta: { color: theme.textDim, fontSize: font.caption, marginTop: 2 },
  mixerArrow: { color: theme.accent, fontSize: 28, fontWeight: '300' },
  bottomRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xl + space.xs },
  bottomBtn: {
    flex: 1, // 50% cada
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bottomBtnDisabled: { opacity: 0.4 },
  bottomBtnText: { color: theme.text, fontSize: font.label, fontWeight: '600' },
  bottomBtnTextDim: { color: theme.textFaint },
  adminBtnOn: { borderColor: theme.accent, backgroundColor: theme.accentDim },
  adminBtnTextOn: { color: theme.text },
});
