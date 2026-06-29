import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

// Polyfill global do Buffer — usado pelo codec OSC (src/osc/osc.ts) para montar
// e ler os pacotes binários enviados/recebidos da mesa via UDP.
import { Buffer } from 'buffer';
// expomos o Buffer no escopo global para o react-native-udp/codec OSC
(global as typeof globalThis & { Buffer: typeof Buffer }).Buffer =
  (global as typeof globalThis & { Buffer?: typeof Buffer }).Buffer || Buffer;

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
