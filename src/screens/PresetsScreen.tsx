import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMixerStore } from '../store/useMixerStore';
import { usePresetStore, Preset } from '../presets/presetStore';
import { theme, space, radius, font } from '../theme';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Presets'>;

export function PresetsScreen({ navigation }: Props) {
  const [name, setName] = useState('');

  const captureSnapshot = useMixerStore((s) => s.captureSnapshot);
  const applySnapshot = useMixerStore((s) => s.applySnapshot);
  const setMaster = useMixerStore((s) => s.setMaster);
  const master = useMixerStore((s) => s.master);
  const selectedBus = useMixerStore((s) => s.selectedBus);
  const buses = useMixerStore((s) => s.buses);

  const presets = usePresetStore((s) => s.presets);
  const loaded = usePresetStore((s) => s.loaded);
  const load = usePresetStore((s) => s.load);
  const save = usePresetStore((s) => s.save);
  const remove = usePresetStore((s) => s.remove);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await save({
      name: trimmed,
      bus: selectedBus,
      snapshot: captureSnapshot(),
      master,
      createdAt: new Date().toISOString(),
    });
    setName('');
  };

  const onApply = (preset: Preset) => {
    const busName = buses[selectedBus - 1]?.name ?? `Bus ${selectedBus}`;
    Alert.alert('Aplicar preset', `Aplicar "${preset.name}" ao retorno atual (${busName})?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aplicar',
        onPress: () => {
          applySnapshot(preset.snapshot);
          if (preset.master !== undefined) setMaster(preset.master);
          navigation.goBack(); // volta para o mixer
        },
      },
    ]);
  };

  // Salvar por cima: regrava o preset existente com o mix atual (mesmo id/nome).
  const onOverwrite = (preset: Preset) => {
    Alert.alert('Salvar por cima', `Substituir "${preset.name}" pelo mix atual?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salvar por cima',
        onPress: () =>
          save({
            id: preset.id,
            name: preset.name,
            bus: selectedBus,
            snapshot: captureSnapshot(),
            master,
            createdAt: preset.createdAt,
          }),
      },
    ]);
  };

  const onDelete = (preset: Preset) => {
    Alert.alert('Apagar preset', `Apagar "${preset.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => remove(preset.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.saveRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder='Nome do preset (ex.: "João - Guitarra")'
          placeholderTextColor={theme.textDim}
          style={styles.input}
          onSubmitEditing={onSave}
        />
        <Pressable onPress={onSave} disabled={!name.trim()} style={[styles.saveBtn, !name.trim() && styles.disabled]}>
          <Text style={styles.saveBtnText}>Salvar</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Salva o mix atual: nível, pan, on/mute dos 32 canais e o volume geral.</Text>

      <FlatList
        data={presets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum preset salvo ainda.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardMeta}>
              Bus {item.bus} · {new Date(item.createdAt).toLocaleDateString()}
            </Text>

            {/* Ação principal: grande e isolada para evitar toque errado */}
            <Pressable onPress={() => onApply(item)} style={styles.applyBtn}>
              <Ionicons name="play" size={20} color="#03210F" />
              <Text style={styles.applyText}>Aplicar este mix</Text>
            </Pressable>

            {/* Ações secundárias, separadas da principal */}
            <View style={styles.secondaryRow}>
              <Pressable onPress={() => onOverwrite(item)} style={styles.secondaryBtn} hitSlop={6}>
                <Ionicons name="save-outline" size={18} color={theme.textDim} />
                <Text style={styles.secondaryText}>Salvar por cima</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(item)} style={styles.secondaryBtn} hitSlop={6}>
                <Ionicons name="trash-outline" size={18} color={theme.danger} />
                <Text style={[styles.secondaryText, { color: theme.danger }]}>Apagar</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  saveRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  input: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: theme.text,
    fontSize: font.label,
  },
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  saveBtnText: { color: '#03210F', fontWeight: '700', fontSize: font.label },
  disabled: { opacity: 0.5 },
  hint: { color: theme.textFaint, fontSize: font.caption, paddingHorizontal: space.lg, paddingTop: space.sm },
  list: { padding: space.lg, gap: space.lg },
  empty: { color: theme.textDim, textAlign: 'center', marginTop: space.xxl + space.sm },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  cardName: { color: theme.text, fontSize: font.heading, fontWeight: '700' },
  cardMeta: { color: theme.textDim, fontSize: font.caption, marginTop: 2 },
  applyBtn: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    marginTop: space.lg,
  },
  applyText: { color: '#03210F', fontWeight: '700', fontSize: font.body },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
  },
  secondaryText: { color: theme.textDim, fontSize: font.label, fontWeight: '600' },
});
