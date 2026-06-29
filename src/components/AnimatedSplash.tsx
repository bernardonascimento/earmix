import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const BLUE = '#3B82F6';
const GREEN = '#34C759';
const CAP = '#F4F4F8';

// Alturas de repouso dos 3 faders (variadas, como no ícone).
const REST = [120, 150, 104];
const DIP = 0.5; // quanto descem ao "tocar"

interface Props {
  onFinish: () => void;
}

/**
 * Splash animada: os faders "tocam" (descem/sobem) e no final o ícone estoura
 * (escala + fade) revelando o app. Desenhada em Views para animar cada fader.
 */
export function AnimatedSplash({ onFinish }: Props) {
  const h0 = useSharedValue(REST[0]);
  const h1 = useSharedValue(REST[1]);
  const h2 = useSharedValue(REST[2]);
  const heights = [h0, h1, h2];

  // Splash nativa é só preta (sem ícone): o ícone SURGE e cresce do nada.
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Esconde a splash nativa (preta) — fundo continua preto, sem flash.
    SplashScreen.hideAsync().catch(() => {});

    // Surgimento: fade-in + crescimento (~0,7s), do pequeno para o grande
    opacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) });
    scale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.1)) });

    // Faders "tocando" só DEPOIS de crescer: descem um pouco e sobem, defasado
    heights.forEach((h, i) => {
      const rest = REST[i];
      h.value = withDelay(
        760 + i * 110,
        withRepeat(
          withSequence(
            withTiming(rest * DIP, { duration: 260, easing: Easing.inOut(Easing.quad) }),
            withTiming(rest, { duration: 260, easing: Easing.inOut(Easing.quad) }),
          ),
          2,
          false,
        ),
      );
    });

    // Animação dura ~2s; depois o estouro/fade revela o app.
    const explodeAt = 2000;
    const t = setTimeout(() => {
      scale.value = withTiming(1.9, { duration: 450, easing: Easing.in(Easing.cubic) });
      opacity.value = withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) runOnJS(onFinish)();
      });
    }, explodeAt);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Estilos animados fixos (um por fader) — sem hooks dentro de loop.
  const bar0 = useAnimatedStyle(() => ({ height: h0.value }));
  const bar1 = useAnimatedStyle(() => ({ height: h1.value }));
  const bar2 = useAnimatedStyle(() => ({ height: h2.value }));
  const barStyles = [bar0, bar1, bar2];

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.mark, groupStyle]}>
        {/* Fone: headband (arco) + duas conchas */}
        <View style={styles.headband} />
        <View style={[styles.cup, styles.cupLeft]} />
        <View style={[styles.cup, styles.cupRight]} />

        {/* Faders */}
        <View style={styles.faders}>
          {barStyles.map((bs, i) => (
            <View key={i} style={styles.track}>
              <Animated.View style={[styles.bar, bs]}>
                <View style={styles.cap} />
              </Animated.View>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: 230, height: 250, alignItems: 'center', justifyContent: 'flex-end' },
  // Arco do fone (borda em U invertido)
  headband: {
    position: 'absolute',
    top: 4,
    left: 31, // centraliza no container de 230 de largura
    width: 168,
    height: 104,
    borderColor: BLUE,
    borderTopWidth: 22,
    borderLeftWidth: 22,
    borderRightWidth: 22,
    borderTopLeftRadius: 86,
    borderTopRightRadius: 86,
  },
  cup: {
    position: 'absolute',
    width: 34,
    height: 78,
    borderRadius: 17,
    backgroundColor: BLUE,
    top: 96,
  },
  cupLeft: { left: 25 },
  cupRight: { right: 25 },
  faders: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    height: 168,
    marginBottom: 6,
  },
  track: { width: 22, height: 168, justifyContent: 'flex-end' },
  bar: {
    width: 22,
    borderRadius: 11,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cap: {
    width: 30,
    height: 11,
    borderRadius: 5,
    backgroundColor: CAP,
    marginTop: -3,
  },
});
