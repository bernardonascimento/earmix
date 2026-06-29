# EarMix 🎧

App React Native (Expo) para controlar o **mix de fone** (monitor pessoal) de uma
**Behringer X32** / **Midas M32** direto do celular, na mesma rede Wi-Fi da mesa.

Cada músico escolhe o **bus de retorno** que vai usar e ajusta o send level, pan e
mute de cada canal para esse bus — com metering em tempo real e **presets nomeados**
(ex.: um preset por guitarrista) que salvam e reaplicam o estado dos 32 canais.

Comunicação via **OSC sobre UDP, porta 10023**.

## Arquitetura

```
src/
  osc/        osc.ts        codec OSC (encode/decode ,sifb) + osc.test.ts
              faderLaw.ts   conversão float<->dB (fader law da X32)
  x32/        addresses.ts  construtores/parser de endereços OSC
              X32Client.ts  socket UDP, handshake, /xremote, setters, metering
  store/      useMixerStore.ts   estado (zustand) + ponte bidirecional com a mesa
  presets/    presetStore.ts     persistência local (AsyncStorage)
  components/ VerticalFader, HorizontalSlider, Meter, ChannelStrip, BusSelector
  screens/    ConnectScreen, MixerScreen, PresetsScreen
  theme.ts    tema escuro de palco + paleta de cores de canal da X32
```

## Pré-requisitos

- **Node >= 20.19.4** (o projeto foi criado com 20.17, que dispara avisos `EBADENGINE`;
  atualize para evitar problemas de build). Sugestão: `nvm install 20.19.4 && nvm use 20.19.4`.
- **Xcode 26.1+ recomendado** (Swift 6.2.1+). Veja a nota sobre patches abaixo.
- Conta Expo + EAS CLI (`npm i -g eas-cli`) para gerar os builds nativos.

## Patches (patch-package)

A pasta `patches/` contém correções aplicadas automaticamente no `postinstall`
(`patch-package`). Elas existem porque o Expo SDK 56 (`expo-modules-jsi` /
`expo-modules-core`) usa a sintaxe `weak let` (Swift 6.2.1+, Xcode 26.1+), que **não
compila no Swift 6.2.0 (Xcode 26.0)**. Os patches:

- nas `struct`: trocam `weak let` → `weak var`;
- nas 4 classes `Sendable` (onde `var` mutável é proibido): usam
  `nonisolated(unsafe) weak var`, o mesmo escape hatch que o Expo já adota.

Se você **atualizar o Xcode para 26.1+**, esses patches podem ser removidos
(`rm -rf patches && remova o postinstall`), pois `weak let` passa a compilar nativamente.

## Rodando (dev build)

UDP exige código nativo, então **não roda no Expo Go** — é preciso um *development build*:

```bash
# 1. Gerar os projetos nativos (uma vez, ou após mudar plugins/config)
npx expo prebuild

# 2a. Build de desenvolvimento na nuvem (recomendado)
eas build --profile development --platform ios     # ou android

# 2b. ...ou local, com Xcode/Android Studio instalados
npx expo run:ios
npx expo run:android

# 3. Iniciar o Metro e abrir no dev client
npx expo start --dev-client
```

Para gerar instaláveis de teste (IPA/APK):

```bash
eas build --profile preview --platform all
```

## Testes

```bash
npm test          # codec OSC, fader law e parser de endereços
npx tsc --noEmit  # checagem de tipos
```

## Modo demo (sem mesa)

Na tela de conexão há **"🎚️ Entrar no modo demo (sem mesa)"**: popula a UI com 32 canais
nomeados (Kick, Snare, Bass, Vox…), 16 buses de retorno ("Fone Baterista", "Fone Vocal"…),
um mix diferente por bus (preservado ao alternar) e **metering animado**. Permite testar
faders, mute, pan, seleção de bus e presets sem nenhuma mesa conectada. A lógica vive em
`src/demo/demoData.ts` + flag `demoMode` no store (`src/store/useMixerStore.ts`).

## Uso

1. Conecte o celular na **mesma rede Wi-Fi** da mesa.
2. Abra o app e **Buscar mesas na rede** (descoberta automática via broadcast `/xinfo`)
   ou digite o **IP da mesa** manualmente (porta 10023 é fixa) e toque em **Conectar**.
3. Escolha o **bus de retorno** (seu fone) na tira superior.
4. Ajuste os faders de send, mute e pan de cada canal.
5. Em **Presets**, salve o mix atual com um nome e reaplique quando quiser.

### Descoberta automática

`src/x32/discovery.ts` (puro, testado) faz o parsing das respostas e deriva o endereço
de broadcast /24; `X32Discovery.ts` envia o broadcast e coleta as respostas; o hook
`useMixerDiscovery` obtém o IP local via `expo-network`. Depende de o roteador **não
bloquear broadcast UDP** (comum em redes de palco/domésticas) e da permissão de rede
local no iOS (já declarada).

## Notas / TODO

- **Metering** (`/meters/1`) está implementado em modo best-effort e precisa ser validado
  contra hardware real — o formato do blob pode variar por firmware.
- A **fader law** usada é a documentada no protocolo OSC não-oficial da X32; confira os
  valores em dB com a mesa real.
- Possíveis evoluções: debounce do fader durante o arraste, suporte a canais aux/FX além
  dos 32 de entrada, controle do fader principal do bus de retorno.
```
