# EarMix — questionários de privacidade das lojas

Respostas prontas para os formulários de privacidade da Apple e do Google.
Base: o EarMix **não coleta nem compartilha nenhum dado do usuário**. As preferências
(IP/bus da mesa, presets, marcação de admin) ficam **apenas no aparelho** e não são
enviadas para lugar nenhum. A comunicação com a mesa é local (OSC/UDP na Wi-Fi) e não é
coleta de dados. Coerente com https://earmix.com.br/privacidade

---

## Apple — App Privacy (App Store Connect)

Caminho: App Store Connect › seu app › **App Privacy**.

1. **"Do you or your third-party partners collect data from this app?"**
   → **No, we do not collect data from this app.**

Isso já encerra o questionário: a ficha mostrará **"Data Not Collected"**.

Justificativa (caso precise confirmar internamente): o app não tem login, analytics,
anúncios, SDKs de rastreamento nem envia dados a servidores. Tudo o que salva é local
(via armazenamento do próprio dispositivo).

> Sobre a permissão de **Rede Local** (iOS): ela serve para o app achar e controlar a
> mesa na mesma Wi-Fi. Não é "coleta de dados" — não precisa ser declarada no App Privacy.
> O texto que aparece ao usuário está em `NSLocalNetworkUsageDescription` (app.json).

---

## Google — Data Safety (Play Console)

Caminho: Play Console › seu app › **Segurança dos dados (Data safety)**.

**Coleta e compartilhamento**
- "Your app collects or shares any of the required user data types?" → **No**
- Compartilha dados com terceiros? → **No**

**Perguntas de segurança (aparecem mesmo sem coleta)**
- "Is your app's data encrypted in transit?" → **Não se aplica** (o app não coleta dados
  do usuário; o tráfego OSC com a mesa é controle local, não dado pessoal).
- "Do you provide a way for users to request that their data be deleted?" → como não há
  coleta, não há dados no servidor. As preferências locais somem ao **desinstalar o app**.

**Resumo que a ficha vai exibir:** "No data collected" / "No data shared".

**Tipos de dados** — deixe **tudo desmarcado**. Para referência, o app **não** coleta
nenhuma destas categorias: localização, informações pessoais, financeiras, mensagens,
fotos/vídeos, áudio, arquivos, contatos, atividade no app, histórico de navegação,
identificadores do dispositivo, ou informações de diagnóstico/crash.

---

## Checklist rápido

| Item                                   | Resposta                          |
| -------------------------------------- | --------------------------------- |
| Coleta dados pessoais?                 | Não                               |
| Compartilha com terceiros?             | Não                               |
| Usa analytics / rastreamento / ads?    | Não                               |
| Login / conta?                         | Não                               |
| Dados saem do aparelho?                | Não (só fala com a mesa na Wi-Fi) |
| Apple App Privacy                      | Data Not Collected                |
| Google Data Safety                     | No data collected / shared        |
