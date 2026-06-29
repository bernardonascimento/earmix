import { Buffer } from 'buffer';

/**
 * Codec OSC enxuto, sob medida para o protocolo da Behringer X32 / Midas M32.
 *
 * A X32 fala OSC 1.0 sobre UDP. Usamos apenas os tipos que ela emite/aceita:
 *   ,s  string      ,i  int32      ,f  float32      ,b  blob
 *
 * Layout de uma mensagem OSC:
 *   [address] (string OSC) [typetag] (string OSC, começa com ',') [args...]
 * Strings OSC são terminadas em \0 e preenchidas (padding) até múltiplo de 4 bytes.
 * Inteiros/floats são big-endian de 4 bytes. Blob = int32(tamanho) + bytes + padding.
 */

export type OscArgValue = string | number | Buffer;

export interface OscArg {
  type: 's' | 'i' | 'f' | 'b';
  value: OscArgValue;
}

export interface OscMessage {
  address: string;
  args: OscArg[];
}

/** Arredonda para o próximo múltiplo de 4 (padding OSC). */
function pad4(n: number): number {
  return (n + 3) & ~3;
}

/** Codifica uma string OSC: bytes + \0 + padding até múltiplo de 4. */
function encodeString(str: string): Buffer {
  const raw = Buffer.from(str, 'ascii');
  const out = Buffer.alloc(pad4(raw.length + 1)); // +1 garante ao menos um \0
  raw.copy(out, 0);
  return out;
}

/**
 * Infere o typetag a partir do valor JS quando o chamador não especifica:
 *  - number inteiro  -> 'i'   (use {type:'f'} para forçar float)
 *  - number fracionário -> 'f'
 *  - string -> 's', Buffer -> 'b'
 */
function inferArg(value: OscArgValue): OscArg {
  if (typeof value === 'string') return { type: 's', value };
  if (Buffer.isBuffer(value)) return { type: 'b', value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { type: 'i', value } : { type: 'f', value };
  }
  throw new Error(`Valor OSC não suportado: ${String(value)}`);
}

/** Normaliza args: aceita valores crus (inferência) ou {type,value} explícitos. */
function normalizeArgs(args: Array<OscArg | OscArgValue> = []): OscArg[] {
  return args.map((a) =>
    typeof a === 'object' && a !== null && 'type' in a && 'value' in a
      ? (a as OscArg)
      : inferArg(a as OscArgValue),
  );
}

/**
 * Codifica uma mensagem OSC em um Buffer pronto para envio via UDP.
 * Aceita args já tipados ({type,value}) ou valores crus (tipo inferido).
 */
export function encode(address: string, args: Array<OscArg | OscArgValue> = []): Buffer {
  const normalized = normalizeArgs(args);

  const parts: Buffer[] = [encodeString(address)];
  const typetag = ',' + normalized.map((a) => a.type).join('');
  parts.push(encodeString(typetag));

  for (const arg of normalized) {
    switch (arg.type) {
      case 's':
        parts.push(encodeString(String(arg.value)));
        break;
      case 'i': {
        const b = Buffer.alloc(4);
        b.writeInt32BE(Number(arg.value) | 0, 0);
        parts.push(b);
        break;
      }
      case 'f': {
        const b = Buffer.alloc(4);
        b.writeFloatBE(Number(arg.value), 0);
        parts.push(b);
        break;
      }
      case 'b': {
        const data = Buffer.isBuffer(arg.value) ? arg.value : Buffer.from(String(arg.value));
        const header = Buffer.alloc(4);
        header.writeInt32BE(data.length, 0);
        const padded = Buffer.alloc(pad4(data.length));
        data.copy(padded, 0);
        parts.push(header, padded);
        break;
      }
      default:
        throw new Error(`Tipo OSC não suportado: ${(arg as OscArg).type}`);
    }
  }

  return Buffer.concat(parts);
}

/** Lê uma string OSC a partir de `offset`. Retorna o valor e o offset seguinte. */
function readString(buf: Buffer, offset: number): { value: string; next: number } {
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end++;
  const value = buf.toString('ascii', offset, end);
  return { value, next: offset + pad4(end - offset + 1) };
}

/**
 * Decodifica uma mensagem OSC. Lança erro para entradas inválidas.
 * Não trata bundles aqui — use `decodePacket` para isso.
 */
export function decodeMessage(buf: Buffer): OscMessage {
  const { value: address, next } = readString(buf, 0);
  let offset = next;

  // typetag é opcional em algumas implementações, mas a X32 sempre envia.
  if (offset >= buf.length || buf[offset] !== 0x2c /* ',' */) {
    return { address, args: [] };
  }
  const tagRead = readString(buf, offset);
  const tags = tagRead.value.slice(1); // remove a vírgula inicial
  offset = tagRead.next;

  const args: OscArg[] = [];
  for (const tag of tags) {
    switch (tag) {
      case 's': {
        const r = readString(buf, offset);
        args.push({ type: 's', value: r.value });
        offset = r.next;
        break;
      }
      case 'i':
        args.push({ type: 'i', value: buf.readInt32BE(offset) });
        offset += 4;
        break;
      case 'f':
        args.push({ type: 'f', value: buf.readFloatBE(offset) });
        offset += 4;
        break;
      case 'b': {
        const size = buf.readInt32BE(offset);
        offset += 4;
        const data = buf.subarray(offset, offset + size);
        args.push({ type: 'b', value: Buffer.from(data) });
        offset += pad4(size);
        break;
      }
      default:
        throw new Error(`Tipo OSC desconhecido no typetag: '${tag}'`);
    }
  }

  return { address, args };
}

/**
 * Decodifica um pacote OSC, tratando bundles ('#bundle') recursivamente.
 * A X32 normalmente envia mensagens simples, mas isso garante robustez.
 */
export function decodePacket(buf: Buffer): OscMessage[] {
  if (buf.length >= 8 && buf.toString('ascii', 0, 7) === '#bundle') {
    const messages: OscMessage[] = [];
    let offset = 16; // 8 ('#bundle\0') + 8 (timetag)
    while (offset < buf.length) {
      const size = buf.readInt32BE(offset);
      offset += 4;
      const element = buf.subarray(offset, offset + size);
      messages.push(...decodePacket(Buffer.from(element)));
      offset += size;
    }
    return messages;
  }
  return [decodeMessage(buf)];
}

/** Helper: primeiro argumento como número (float/int). undefined se ausente. */
export function firstNumber(msg: OscMessage): number | undefined {
  const a = msg.args[0];
  return a && (a.type === 'f' || a.type === 'i') ? Number(a.value) : undefined;
}

/** Helper: primeiro argumento como string. undefined se ausente. */
export function firstString(msg: OscMessage): string | undefined {
  const a = msg.args[0];
  return a && a.type === 's' ? String(a.value) : undefined;
}
