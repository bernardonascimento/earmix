/**
 * Construtores de endereços OSC da X32 / M32.
 *
 * Canais e buses são sempre numerados com 2 dígitos: 01–32 (canais), 01–16 (buses).
 * Centralizar aqui evita erros de formatação espalhados pelo código.
 */

export const CHANNEL_COUNT = 32;
export const BUS_COUNT = 16;

/** Formata um número 1-based como string de 2 dígitos ("1" -> "01"). */
export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export const X32 = {
  /** Info da mesa (handshake). Resposta: server name, model, firmware. */
  info: () => '/info',
  xinfo: () => '/xinfo',
  /** Mantém o app inscrito para receber updates de parâmetros (reenviar ~a cada 9s). */
  xremote: () => '/xremote',

  // ----- Canais -----
  /** Mute do canal (1 = ligado/aberto, 0 = mutado). */
  channelOn: (ch: number) => `/ch/${pad2(ch)}/mix/on`,
  /** Fader principal do canal (float 0.0–1.0). */
  channelFader: (ch: number) => `/ch/${pad2(ch)}/mix/fader`,
  /** Nome do canal (string). */
  channelName: (ch: number) => `/ch/${pad2(ch)}/config/name`,
  /** Cor do canal (int). */
  channelColor: (ch: number) => `/ch/${pad2(ch)}/config/color`,

  // ----- Sends de canal -> bus (o coração da mixagem de fone) -----
  /** Nível de send do canal `ch` para o bus `bus` (float 0.0–1.0). */
  sendLevel: (ch: number, bus: number) => `/ch/${pad2(ch)}/mix/${pad2(bus)}/level`,
  /** Pan do send do canal `ch` para o bus `bus` (float 0.0–1.0, 0.5 = centro). */
  sendPan: (ch: number, bus: number) => `/ch/${pad2(ch)}/mix/${pad2(bus)}/pan`,
  /** Liga/desliga o send do canal `ch` para o bus `bus` (int 0/1). */
  sendOn: (ch: number, bus: number) => `/ch/${pad2(ch)}/mix/${pad2(bus)}/on`,

  // ----- Buses (retornos) -----
  /** Nome do bus (string). */
  busName: (bus: number) => `/bus/${pad2(bus)}/config/name`,
  /** Cor do bus (int 0-15) — mesma paleta dos canais. */
  busColor: (bus: number) => `/bus/${pad2(bus)}/config/color`,
  /** Fader master do bus (volume geral daquele retorno/fone). Float 0.0–1.0. */
  busFader: (bus: number) => `/bus/${pad2(bus)}/mix/fader`,
  /** Liga/desliga o bus inteiro (1 = ativo, 0 = mutado). Muta só ESTE retorno/fone. */
  busOn: (bus: number) => `/bus/${pad2(bus)}/mix/on`,

  // ----- Main LR (mistura da casa / PA — só admin) -----
  /** Fader master do Main LR (volume da PA). Float 0.0–1.0. */
  mainFader: () => '/main/st/mix/fader',
  /** Liga/desliga o Main LR inteiro (mute da PA). */
  mainOn: () => '/main/st/mix/on',
  /** Nome do Main LR. */
  mainName: () => '/main/st/config/name',
  /** Cor do Main LR. */
  mainColor: () => '/main/st/config/color',
} as const;

/** Regex para extrair o número do canal de um endereço /ch/NN/... */
const CH_RE = /^\/ch\/(\d{2})\//;
/** Regex para extrair canal e bus de um endereço de send /ch/NN/mix/BB/... */
const SEND_RE = /^\/ch\/(\d{2})\/mix\/(\d{2})\/(level|pan|on)$/;
/** Regex para o nome do bus. */
const BUS_NAME_RE = /^\/bus\/(\d{2})\/config\/name$/;
/** Regex para a cor do bus. */
const BUS_COLOR_RE = /^\/bus\/(\d{2})\/config\/color$/;
/** Regex para o fader master do bus. */
const BUS_FADER_RE = /^\/bus\/(\d{2})\/mix\/fader$/;
/** Regex para o on/off do bus. */
const BUS_ON_RE = /^\/bus\/(\d{2})\/mix\/on$/;
/** Regex do Main LR. */
const MAIN_FADER_RE = /^\/main\/st\/mix\/fader$/;
const MAIN_ON_RE = /^\/main\/st\/mix\/on$/;
const MAIN_NAME_RE = /^\/main\/st\/config\/name$/;
const MAIN_COLOR_RE = /^\/main\/st\/config\/color$/;

export interface ParsedAddress {
  kind: 'channelOn' | 'channelFader' | 'channelName' | 'channelColor' | 'sendLevel' | 'sendPan' | 'sendOn' | 'busName' | 'busColor' | 'busFader' | 'busOn' | 'mainFader' | 'mainOn' | 'mainName' | 'mainColor' | 'unknown';
  channel?: number;
  bus?: number;
}

/** Interpreta um endereço OSC recebido da mesa para roteá-lo no store. */
export function parseAddress(address: string): ParsedAddress {
  const send = SEND_RE.exec(address);
  if (send) {
    const channel = parseInt(send[1], 10);
    const bus = parseInt(send[2], 10);
    const kind = send[3] === 'level' ? 'sendLevel' : send[3] === 'pan' ? 'sendPan' : 'sendOn';
    return { kind, channel, bus };
  }

  const busName = BUS_NAME_RE.exec(address);
  if (busName) return { kind: 'busName', bus: parseInt(busName[1], 10) };

  const busColor = BUS_COLOR_RE.exec(address);
  if (busColor) return { kind: 'busColor', bus: parseInt(busColor[1], 10) };

  const busFader = BUS_FADER_RE.exec(address);
  if (busFader) return { kind: 'busFader', bus: parseInt(busFader[1], 10) };

  const busOn = BUS_ON_RE.exec(address);
  if (busOn) return { kind: 'busOn', bus: parseInt(busOn[1], 10) };

  if (MAIN_FADER_RE.test(address)) return { kind: 'mainFader' };
  if (MAIN_ON_RE.test(address)) return { kind: 'mainOn' };
  if (MAIN_NAME_RE.test(address)) return { kind: 'mainName' };
  if (MAIN_COLOR_RE.test(address)) return { kind: 'mainColor' };

  const ch = CH_RE.exec(address);
  if (ch) {
    const channel = parseInt(ch[1], 10);
    if (address.endsWith('/mix/on')) return { kind: 'channelOn', channel };
    if (address.endsWith('/mix/fader')) return { kind: 'channelFader', channel };
    if (address.endsWith('/config/name')) return { kind: 'channelName', channel };
    if (address.endsWith('/config/color')) return { kind: 'channelColor', channel };
  }

  return { kind: 'unknown' };
}
