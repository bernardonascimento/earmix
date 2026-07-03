import { OscMessage } from '../osc/osc';

/** Uma mesa encontrada na rede via broadcast /xinfo. */
export interface DiscoveredMixer {
  ip: string;
  name: string;
  model: string;
  firmware: string;
}

/**
 * Resposta de handshake de uma mesa? É o que distingue uma X32/M32 de um IP
 * qualquer que não responde nada (ou que não fala o protocolo). Exigimos o
 * endereço /info|/xinfo COM ao menos uma string nos args — pacote vazio não conta.
 */
export function isInfoReply(msg: OscMessage): boolean {
  const isInfo = msg.address === '/info' || msg.address === '/xinfo';
  return isInfo && msg.args.some((a) => a.type === 's' && String(a.value).length > 0);
}

/**
 * Interpreta a resposta de descoberta da mesa.
 *
 * A X32/M32 responde ao broadcast com:
 *   /xinfo ,ssss <ip> <nome> <modelo> <firmware>
 * Algumas firmwares respondem com /info (sem o IP nos args). Por isso usamos sempre
 * o IP de origem do pacote (`fromAddress`) como fonte da verdade do IP, e os args
 * apenas para nome/modelo/firmware.
 *
 * Retorna null se a mensagem não for uma resposta de info reconhecível.
 */
export function parseInfoReply(msg: OscMessage, fromAddress: string): DiscoveredMixer | null {
  const isInfo = msg.address === '/xinfo' || msg.address === '/info';
  if (!isInfo) return null;

  const strings = msg.args.filter((a) => a.type === 's').map((a) => String(a.value));

  // /xinfo: [ip, nome, modelo, firmware]; /info: [versão, nome, modelo, firmware]
  if (msg.address === '/xinfo' && strings.length >= 4) {
    return { ip: fromAddress || strings[0], name: strings[1], model: strings[2], firmware: strings[3] };
  }
  if (strings.length >= 4) {
    return { ip: fromAddress, name: strings[1], model: strings[2], firmware: strings[3] };
  }
  // Resposta mínima: ao menos sabemos que há uma mesa nesse IP.
  return { ip: fromAddress, name: strings[1] ?? 'Mesa', model: strings[2] ?? '', firmware: strings[3] ?? '' };
}

/**
 * Deriva o endereço de broadcast /24 a partir do IP do dispositivo
 * (ex.: 192.168.0.37 -> 192.168.0.255). É o caso esmagadoramente comum em redes
 * domésticas/de palco. Retorna null se o IP não for IPv4 válido.
 */
export function subnetBroadcast(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(ip);
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3]}.255`;
}

/** Prefixo /24 de um IPv4 ("192.168.1.34" -> "192.168.1"), ou null. */
export function prefix24(ip: string | null | undefined): string | null {
  const m = ip ? /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(ip) : null;
  return m ? m[1] : null;
}

/** Alvos de broadcast a tentar: o /24 derivado do IP local + o global. */
export function broadcastTargets(localIp: string | null | undefined): string[] {
  const targets = new Set<string>(['255.255.255.255']);
  const subnet = subnetBroadcast(localIp);
  if (subnet) targets.add(subnet);
  return [...targets];
}

/**
 * IPs da sub-rede /24 para varredura UNICAST (ex.: 192.168.0.1 .. .254). A /24 vem de
 * `baseIp`; `selfIp` (default = baseIp) é excluído quando está na mesma /24 (não faz
 * sentido varrer o próprio aparelho). Passar selfIp separado permite derivar a /24 de
 * um IP conhecido (ex.: o da mesa) mesmo sem saber o IP local — caso do iPad, onde o
 * getIpAddressAsync às vezes não retorna. Unicast funciona no device sem entitlement.
 * Retorna [] se `baseIp` não for IPv4 válido.
 */
export function sweepTargets(
  baseIp: string | null | undefined,
  selfIp: string | null | undefined = baseIp,
): string[] {
  const m = baseIp ? /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(baseIp) : null;
  if (!m) return [];
  const prefix = `${m[1]}.${m[2]}.${m[3]}.`;
  let self = -1;
  const sm = selfIp ? /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(selfIp) : null;
  if (sm && `${sm[1]}.${sm[2]}.${sm[3]}.` === prefix) self = parseInt(sm[4], 10);
  const out: string[] = [];
  for (let host = 1; host <= 254; host++) {
    if (host !== self) out.push(prefix + host);
  }
  return out;
}
