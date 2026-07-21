import React, { useRef, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { theme, space, radius, font, family } from '../theme';

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  onCancel: () => void;
  onSubmit: (user: string, password: string) => void;
}

/**
 * Prompt de usuário + senha cross-platform (o Alert.prompt do RN só tem 1 campo).
 * Modal central simples — usado para liberar o modo admin.
 */
export function PasswordPrompt({ visible, title = 'Modo admin', message, onCancel, onSubmit }: Props) {
  const [user, setUser] = useState('');
  const [value, setValue] = useState('');
  const userRef = useRef<TextInput>(null);
  const inputRef = useRef<TextInput>(null);
  const { height } = useWindowDimensions();

  // Abre o teclado junto com o modal (autoFocus não funciona em Modal no Android).
  const handleShow = () => {
    setUser('');
    setValue('');
    setTimeout(() => userRef.current?.focus(), 150);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onShow={handleShow}
      onRequestClose={onCancel}
    >
      {/* Card fixo na parte alta da tela: fica acima do teclado sem precisar do
          KeyboardAvoidingView (que causava um flicker ao recentralizar quando o
          teclado abria). paddingTop proporcional deixa espaço p/ status bar. */}
      <Pressable style={[styles.backdrop, { paddingTop: height * 0.12 }]} onPress={onCancel}>
        <View style={styles.center}>
          {/* Pressable interno evita que o toque no card feche o modal. */}
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <TextInput
              ref={userRef}
              value={user}
              onChangeText={setUser}
              placeholder="Usuário"
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="next"
              onSubmitEditing={() => inputRef.current?.focus()}
            />
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={setValue}
              placeholder="Senha"
              placeholderTextColor={theme.textDim}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              onSubmitEditing={() => onSubmit(user, value)}
            />
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.ok]} onPress={() => onSubmit(user, value)}>
                <Text style={styles.okText}>Entrar</Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: space.xl,
  },
  title: { color: theme.text, fontSize: font.heading, fontFamily: family.display },
  message: { color: theme.textDim, fontSize: font.caption, marginTop: space.xs, lineHeight: 18 },
  input: {
    marginTop: space.lg,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    color: theme.text,
    fontSize: font.body,
    fontFamily: family.monoRegular,
  },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space.lg, borderRadius: radius.md },
  cancel: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
  cancelText: { color: theme.text, fontWeight: '600', fontSize: font.body },
  ok: { backgroundColor: theme.accent },
  okText: { color: '#03210F', fontWeight: '700', fontSize: font.body },
});
