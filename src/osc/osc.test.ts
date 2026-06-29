import { Buffer } from 'buffer';
import { encode, decodeMessage, decodePacket } from './osc';

describe('codec OSC', () => {
  it('codifica endereço sem argumentos com padding correto', () => {
    const buf = encode('/xremote');
    // '/xremote' = 8 chars -> precisa de \0 -> 9 -> pad para 12; typetag ',' -> 4
    expect(buf.length).toBe(12 + 4);
    expect(buf.toString('ascii', 0, 8)).toBe('/xremote');
    // typetag deve ser apenas a vírgula
    expect(buf[12]).toBe(0x2c);
  });

  it('faz round-trip de float (send level)', () => {
    const buf = encode('/ch/01/mix/05/level', [{ type: 'f', value: 0.75 }]);
    const msg = decodeMessage(buf);
    expect(msg.address).toBe('/ch/01/mix/05/level');
    expect(msg.args).toHaveLength(1);
    expect(msg.args[0].type).toBe('f');
    expect(msg.args[0].value).toBeCloseTo(0.75, 5);
  });

  it('faz round-trip de int (mute on/off)', () => {
    const buf = encode('/ch/12/mix/on', [{ type: 'i', value: 1 }]);
    const msg = decodeMessage(buf);
    expect(msg.address).toBe('/ch/12/mix/on');
    expect(msg.args[0]).toEqual({ type: 'i', value: 1 });
  });

  it('faz round-trip de string (nome do canal)', () => {
    const buf = encode('/ch/03/config/name', [{ type: 's', value: 'Vocal' }]);
    const msg = decodeMessage(buf);
    expect(msg.address).toBe('/ch/03/config/name');
    expect(msg.args[0]).toEqual({ type: 's', value: 'Vocal' });
  });

  it('infere tipos a partir de valores crus', () => {
    const msg = decodeMessage(encode('/test', [1, 0.5, 'abc']));
    expect(msg.args.map((a) => a.type)).toEqual(['i', 'f', 's']);
    expect(msg.args[0].value).toBe(1);
    expect(msg.args[1].value).toBeCloseTo(0.5, 5);
    expect(msg.args[2].value).toBe('abc');
  });

  it('faz round-trip de blob (meters)', () => {
    const payload = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    const buf = encode('/meters/1', [{ type: 'b', value: payload }]);
    const msg = decodeMessage(buf);
    expect(msg.args[0].type).toBe('b');
    expect(Buffer.compare(msg.args[0].value as Buffer, payload)).toBe(0);
  });

  it('mantém alinhamento de 4 bytes para strings de tamanhos variados', () => {
    for (const name of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      const buf = encode('/ch/01/config/name', [{ type: 's', value: name }]);
      expect(buf.length % 4).toBe(0);
      expect(decodeMessage(buf).args[0].value).toBe(name);
    }
  });

  it('decodePacket trata mensagem simples', () => {
    const buf = encode('/info');
    const msgs = decodePacket(buf);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].address).toBe('/info');
  });
});
