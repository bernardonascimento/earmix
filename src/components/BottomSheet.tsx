import React, { useCallback, useEffect, useRef } from 'react';
import { Text, StyleSheet, useWindowDimensions } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // isOpenRef = estado REAL do sheet (via onChange). wantVisible = o que o pai quer.
  // Só chamamos present()/dismiss() quando há DIVERGÊNCIA real — nunca um dismiss()
  // redundante (que corrompia a pilha do gorhom quando o modal já fechou pelo backdrop,
  // fazendo os modais pararem de abrir depois de alguns abre/fecha).
  const isOpenRef = useRef(false);
  const wantVisible = useRef(false);
  // onClose vem como arrow nova a cada render do pai; o Mixer re-renderiza ~20x/s (VU).
  // Guardamos numa ref para os callbacks do gorhom (onChange/onDismiss) terem identidade
  // ESTÁVEL — senão o sheet re-configura em loop durante a medição e estoura o render
  // ("Maximum update depth"). É por isso que só o bus picker crashava.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    wantVisible.current = visible;
    if (visible && !isOpenRef.current) ref.current?.present();
    else if (!visible && isOpenRef.current) ref.current?.dismiss();
  }, [visible]);

  const handleChange = useCallback((index: number) => {
    const wasOpen = isOpenRef.current;
    isOpenRef.current = index >= 0;
    // Só sincroniza o pai na TRANSIÇÃO aberto→fechado — não a cada onChange. O gorhom
    // dispara onChange várias vezes durante a medição; chamar onClose() (setState) em
    // todas causava loop de re-render ("Maximum update depth"). wasOpen corta o loop.
    if (wasOpen && index < 0 && wantVisible.current) {
      wantVisible.current = false;
      onCloseRef.current();
    }
  }, []);

  // Rede de segurança ao desmontar: estado fechado e pai coerente.
  const handleDismiss = useCallback(() => {
    isOpenRef.current = false;
    if (wantVisible.current) {
      wantVisible.current = false;
      onCloseRef.current();
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.62} />
    ),
    [],
  );

  const header = title ? <Text style={styles.title}>{title}</Text> : null;

  // Dinâmico até no máximo 85% da tela; acima disso o BottomSheetScrollView rola. (O
  // crash "Maximum update depth" era do VU a 20 Hz — resolvido pausando o metering com
  // o sheet aberto — não deste limite, que pode voltar.)
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Padding inferior + safe area (barra de navegação do Android cortava o último item).
  const contentStyle = [styles.content, { paddingBottom: space.xxl + insets.bottom }];

  return (
    <BottomSheetModal
      ref={ref}
      enablePanDownToClose
      maxDynamicContentSize={height * 0.85}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      onChange={handleChange}
      onDismiss={handleDismiss}
    >
      {scrollable ? (
        <BottomSheetScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={contentStyle}>
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
  content: { paddingHorizontal: space.xl },
  title: { color: theme.text, fontSize: font.heading, fontFamily: family.display, marginBottom: space.md },
});
