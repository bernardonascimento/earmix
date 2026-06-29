import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';

import { RootStackParamList } from './src/navigation';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { MixerScreen } from './src/screens/MixerScreen';
import { PresetsScreen } from './src/screens/PresetsScreen';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { useConnectionManager } from './src/x32/useConnectionManager';
import { theme } from './src/theme';

// Mantém a splash nativa até a splash ANIMADA assumir (sem flash).
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 350 });

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.bg,
    card: theme.surface,
    text: theme.text,
    border: theme.border,
    primary: theme.accent,
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });
  const [splashDone, setSplashDone] = useState(false);

  // Reconecta sozinho ao voltar do background ou trocar de Wi-Fi.
  useConnectionManager();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar style="light" />
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: theme.surface },
                headerTintColor: theme.text,
                contentStyle: { backgroundColor: theme.bg },
              }}
            >
              <Stack.Screen name="Connect" component={ConnectScreen} options={{ headerShown: false }} />
              <Stack.Screen
                name="Mixer"
                component={MixerScreen}
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen name="Presets" component={PresetsScreen} options={{ title: 'Presets' }} />
            </Stack.Navigator>
          </NavigationContainer>
          {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
