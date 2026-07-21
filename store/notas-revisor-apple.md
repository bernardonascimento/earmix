# EarMix — Notas para o revisor (App Store)

Cole o bloco abaixo no App Store Connect em **App Review Information → Notes**.
A Apple confirmou que pode responder no idioma de sua preferência, então usamos português.

Campos relacionados (App Review Information):
- **Sign-In required?** → **Não** (o app não exige cadastro/login para funcionar; o
  "Modo admin" é um desbloqueio opcional).
- **User Name / Password** (campos opcionais): para facilitar, preencha também com
  `admin` / `monitor@admin` — são as credenciais do Modo admin descritas nas notas.
- **Contact:** seu nome + e-mail (bernardonasciimento@gmail.com) + telefone.
- **Notes:** cole o bloco abaixo.

---

## Texto para colar (PT)

```
O EarMix é um controle remoto para o mix de retorno (fone/in-ear) das mesas de som
Behringer X32 e Midas M32. Ele se comunica com a mesa pela rede Wi-Fi local, via
protocolo OSC (UDP, porta 10023).

VÍDEO DE DEMONSTRAÇÃO
Vídeo mostrando o app rodando em um iPad físico (iPad 9ª geração, iPadOS 26.5), a
conexão inicial com a mesa Behringer X32 e o fluxo completo de uso com o hardware:
https://www.youtube.com/shorts/PpHi5ieFyvI

COMO TESTAR SEM UMA MESA FÍSICA
Como não há uma mesa X32/M32 disponível durante a revisão, o app tem um MODO DEMO
embutido, que simula um console completo (32 canais e 16 retornos), sem nenhum
hardware. Para verificar TODAS as funcionalidades, siga os passos abaixo NESTA ORDEM:

PASSO 1 — Desbloquear o Modo admin (libera o controle "Main LR")
O controle "Main LR" (mix da casa/PA) fica oculto por padrão e só aparece após entrar
no Modo admin.
1. Na primeira tela (tela de conexão), no rodapé, toque em "Modo admin" (ícone de
   cadeado, botão à direita).
2. No formulário, informe:
      Usuário: admin
      Senha:   monitor@admin
3. Toque em "Entrar". As credenciais serão validadas e aparecerá a mensagem:
   "Modo admin ativado — acesse o Modo demo ou selecione uma mesa de som." O botão
   passa a exibir "Admin".

PASSO 2 — Entrar no Modo demo
1. Ainda na primeira tela, no rodapé, toque em "Modo demo" (ícone de fone, botão à
   esquerda).
2. O app abre um mixer simulado, já com o Modo admin ativo.

PASSO 3 — Verificar as funcionalidades (no mixer)
- Ajustar o volume de cada canal (faders).
- Silenciar/reativar canais (mute).
- Trocar de retorno / "bus" de fone (cada músico tem o próprio mix).
- Abrir e usar o controle "Main LR" (mix da casa) — visível por causa do PASSO 1.
- Salvar e recuperar presets.
Isso cobre todo o fluxo do app, sem necessidade de hardware.

PERMISSÃO DE REDE LOCAL
O iOS pede acesso à Rede Local. É usado APENAS para descobrir e controlar a mesa
X32/M32 na mesma rede Wi-Fi. O app não tem contas de usuário, não coleta dados
pessoais e não envia nada para nenhum servidor — toda a comunicação fica entre o
dispositivo e a mesa, na rede local.

OBSERVAÇÕES
- A interface do app está em português (mercado principal: Brasil).
- O Modo admin é apenas um desbloqueio local de uma funcionalidade avançada (Main LR);
  o app não exige login para uso normal.
```
