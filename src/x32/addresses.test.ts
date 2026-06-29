import { X32, parseAddress, pad2 } from './addresses';

describe('endereços OSC X32', () => {
  it('formata canais/buses com 2 dígitos', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(16)).toBe('16');
    expect(X32.sendLevel(1, 5)).toBe('/ch/01/mix/05/level');
    expect(X32.channelOn(32)).toBe('/ch/32/mix/on');
    expect(X32.busName(10)).toBe('/bus/10/config/name');
  });

  it('parseia send level/pan/on', () => {
    expect(parseAddress('/ch/03/mix/07/level')).toEqual({ kind: 'sendLevel', channel: 3, bus: 7 });
    expect(parseAddress('/ch/12/mix/02/pan')).toEqual({ kind: 'sendPan', channel: 12, bus: 2 });
    expect(parseAddress('/ch/01/mix/16/on')).toEqual({ kind: 'sendOn', channel: 1, bus: 16 });
  });

  it('parseia atributos de canal', () => {
    expect(parseAddress('/ch/05/mix/on')).toEqual({ kind: 'channelOn', channel: 5 });
    expect(parseAddress('/ch/05/mix/fader')).toEqual({ kind: 'channelFader', channel: 5 });
    expect(parseAddress('/ch/05/config/name')).toEqual({ kind: 'channelName', channel: 5 });
    expect(parseAddress('/ch/05/config/color')).toEqual({ kind: 'channelColor', channel: 5 });
  });

  it('parseia nome de bus e desconhecidos', () => {
    expect(parseAddress('/bus/08/config/name')).toEqual({ kind: 'busName', bus: 8 });
    expect(parseAddress('/info').kind).toBe('unknown');
  });
});
