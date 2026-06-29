import React, { useCallback, useEffect, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { theme, space, radius, font, family } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Use quando o conteúdo é uma lista que pode precisar rolar (ex.: seletor de bus). */
  scrollable?: boolean;
  children: React.ReactNode;
}

/**
 * Bottom sheet padronizado, sobre @gorhom/bottom-sheet.
 * Arrastar a folha para baixo fecha (gesto roda na UI thread via reanimated),
 * o fundo escurece junto, e tocar fora também fecha. Tamanho dinâmico ao conteúdo.
 */
export function BottomSheet({ visible, onClose, title, scrollable, children }: Props) {
  const ref = useRef<BottomSheetModal>(null);
  const presented = useRef(false);

  useEffect(() => {
    if (visible) {
      ref.current?.present();
      presented.current = true;
    } else if (presented.current) {
      // Só descarta se já tinha sido aberto — chamar dismiss() antes do primeiro
      // present() deixa o modal num estado que ignora aberturas futuras.
      ref.current?.dismiss();
      presented.current = false;
    }
  }, [visible]);

  // Quando o gorhom fecha sozinho (arraste/toque fora), zera `presented` ANTES de
  // avisar o pai — assim o efeito de `visible=false` não chama um dismiss() redundante
  // (que quebraria o próximo present()).
  const handleDismiss = useCallback(() => {
    presented.current = false;
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.62} />
    ),
    [],
  );

  const header = title ? <Text style={styles.title}>{title}</Text> : null;

  return (
    <BottomSheetModal
      ref={ref}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      onDismiss={handleDismiss}
    >
      {scrollable ? (
        <BottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={styles.content}>
          {header}
          {children}
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  handle: { backgroundColor: theme.border, width: 44, height: 5 },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  title: { color: theme.text, fontSize: font.heading, fontFamily: family.display, marginBottom: space.md },
});
