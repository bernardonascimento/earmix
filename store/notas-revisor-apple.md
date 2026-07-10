# EarMix — Notas para o revisor (App Store)

Cole no App Store Connect em **App Review Information → Notes**.
Recomendado usar a versão em INGLÊS (revisores internacionais). O app não tem
login, então não é preciso preencher usuário/senha de conta — só as notas.

---

## EN (recomendado)

```
EarMix is a remote control for the personal monitor (in-ear/headphone) mix of
Behringer X32 and Midas M32 audio mixing consoles. It talks to the console over
the local Wi-Fi network using the OSC protocol (UDP, port 10023).

HOW TO TEST WITHOUT A CONSOLE
Since a physical mixing console is not available during review, please use DEMO
MODE, which simulates a console with no hardware needed:

1. On the first screen, at the bottom, tap "Modo demo" (Demo mode).
2. The app opens a simulated mixer. You can adjust channel volumes, mute channels,
   switch monitor buses ("retornos") and save/recall presets.

RESTRICTED FEATURE — ADMIN MODE (please enable BEFORE entering demo mode):
The "Main LR" control (the house/PA master) is hidden by default and only appears
in admin mode. To test it:
1. On the first screen, at the bottom, tap "Modo admin" (Admin mode, lock icon).
2. Enter the password: monitor@admin
3. Tap "Entrar". The button turns into "Admin" and the Main LR control becomes
   available. Then enter Demo mode as above.

LOCAL NETWORK PERMISSION
iOS will ask for Local Network access. It is used ONLY to discover and control the
X32/M32 console on the same Wi-Fi. The app has no accounts, collects no data, and
sends nothing to any server — all communication stays between the phone and the
console on the local network.

The app UI is in Portuguese (primary market: Brazil).
```

---

## PT (caso prefira)

```
O EarMix é um controle remoto para o mix de retorno (fone/in-ear) das mesas de som
Behringer X32 e Midas M32. Ele se comunica com a mesa pela rede Wi-Fi local, via
protocolo OSC (UDP, porta 10023).

COMO TESTAR SEM UMA MESA
Como não há uma mesa física disponível na revisão, use o MODO DEMO, que simula uma
mesa sem precisar de hardware:
1. Na primeira tela, no rodapé, toque em "Modo demo".
2. O app abre um mixer simulado: ajuste volumes, use mute, troque de retorno e
   salve/recupere presets.

FUNCIONALIDADE RESTRITA — MODO ADMIN (ative ANTES de entrar no demo):
O controle "Main LR" (som da casa/PA) fica oculto e só aparece no modo admin.
1. Na primeira tela, no rodapé, toque em "Modo admin" (ícone de cadeado).
2. Digite a senha: monitor@admin
3. Toque em "Entrar" — o Main LR passa a ficar disponível. Depois entre no Modo demo.

PERMISSÃO DE REDE LOCAL
É usada apenas para encontrar e controlar a mesa X32/M32 na mesma Wi-Fi. O app não
tem contas, não coleta dados e não envia nada para servidores.
```

---

## Campos relacionados (App Review Information)
- **Sign-in required?** → No (o app não tem login).
- **Contact:** seu nome + e-mail (bernardonasciimento@gmail.com) + telefone.
- **Notes:** cole o bloco EN acima.
