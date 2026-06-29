import { parseInfoReply, isInfoReply, subnetBroadcast, broadcastTargets, sweepTargets } from './discovery';
import { OscMessage } from '../osc/osc';

function msg(address: string, strings: string[]): OscMessage {
  return { address, args: strings.map((value) => ({ type: 's', value })) };
}

describe('parseInfoReply', () => {
  it('usa o IP de origem e extrai nome/modelo/firmware do /xinfo', () => {
    const m = msg('/xinfo', ['192.168.0.10', 'X32-PALCO', 'X32', '4.06']);
    expect(parseInfoReply(m, '192.168.0.10')).toEqual({
      ip: '192.168.0.10',
      name: 'X32-PALCO',
      model: 'X32',
      firmware: '4.06',
    });
  });

  it('prefere o IP de origem ao do payload no /info', () => {
    const m = msg('/info', ['V2.07', 'Mesa', 'M32', '4.06']);
    expect(parseInfoReply(m, '10.0.0.5')?.ip).toBe('10.0.0.5');
  });

  it('ignora mensagens que não são info', () => {
    expect(parseInfoReply(msg('/ch/01/mix/fader', []), '10.0.0.5')).toBeNull();
  });
});

describe('isInfoReply (handshake de validação)', () => {
  it('aceita /info e /xinfo com pelo menos uma string', () => {
    expect(isInfoReply(msg('/info', ['V2.07', 'Mesa', 'X32', '4.06']))).toBe(true);
    expect(isInfoReply(msg('/xinfo', ['192.168.0.10', 'PALCO', 'X32', '4.06']))).toBe(true);
  });

  it('rejeita pacote de info vazio (sem strings) — não confirma uma mesa', () => {
    expect(isInfoReply({ address: '/info', args: [] })).toBe(false);
    expect(isInfoReply(msg('/info', ['']))).toBe(false);
  });

  it('rejeita qualquer outro endereço (IP que responde outra coisa)', () => {
    expect(isInfoReply(msg('/ch/01/mix/fader', ['x']))).toBe(false);
    expect(isInfoReply({ address: '/status', args: [{ type: 'i', value: 1 }] })).toBe(false);
  });
});

describe('broadcast', () => {
  it('deriva o broadcast /24', () => {
    expect(subnetBroadcast('192.168.0.37')).toBe('192.168.0.255');
    expect(subnetBroadcast('10.1.2.3')).toBe('10.1.2.255');
    expect(subnetBroadcast('texto')).toBeNull();
    expect(subnetBroadcast(null)).toBeNull();
  });

  it('inclui sempre o broadcast global e o /24 quando há IP', () => {
    expect(broadcastTargets('192.168.0.37')).toEqual(
      expect.arrayContaining(['255.255.255.255', '192.168.0.255']),
    );
    expect(broadcastTargets(null)).toEqual(['255.255.255.255']);
  });
});

describe('sweepTargets (varredura unicast)', () => {
  it('gera os hosts /24 menos o próprio IP', () => {
    const t = sweepTargets('192.168.0.37');
    expect(t).toHaveLength(253); // 254 hosts (1..254) menos o próprio
    expect(t).toContain('192.168.0.1');
    expect(t).toContain('192.168.0.254');
    expect(t).not.toContain('192.168.0.37');
  });

  it('retorna vazio para IP inválido', () => {
    expect(sweepTargets(null)).toEqual([]);
    expect(sweepTargets('texto')).toEqual([]);
  });
});
