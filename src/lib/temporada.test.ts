import { describe, expect, it } from 'vitest';
import { SCRIPT_TEMPORADA, temporadaDe } from './temporada';

// Las horas van en UTC: Bogotá es UTC−5.
const bogota = (iso: string) => new Date(iso + '-05:00');

describe('temporadaDe', () => {
  it('se prende el 24 de octubre a medianoche de Bogotá', () => {
    expect(temporadaDe(bogota('2026-10-23T23:59:00'), '')).toBeNull();
    expect(temporadaDe(bogota('2026-10-24T00:00:00'), '')).toBe('halloween');
  });

  it('sigue la noche del 31 y se apaga al amanecer del 1 de noviembre', () => {
    expect(temporadaDe(bogota('2026-10-31T22:00:00'), '')).toBe('halloween');
    expect(temporadaDe(bogota('2026-11-01T05:59:00'), '')).toBe('halloween');
    expect(temporadaDe(bogota('2026-11-01T06:00:00'), '')).toBeNull();
  });

  it('no usa la hora UTC: el 31 a las 9 p.m. de Bogotá ya es 1 de noviembre en UTC', () => {
    expect(temporadaDe(new Date('2026-11-01T02:00:00Z'), '')).toBe('halloween');
  });

  it('el resto del año está apagada', () => {
    expect(temporadaDe(bogota('2026-12-24T20:00:00'), '')).toBeNull();
    expect(temporadaDe(bogota('2027-03-10T12:00:00'), '')).toBeNull();
  });

  it('se puede forzar o apagar con ?temporada=', () => {
    expect(temporadaDe(bogota('2027-03-10T12:00:00'), '?temporada=halloween')).toBe('halloween');
    expect(temporadaDe(bogota('2026-10-31T20:00:00'), '?x=1&temporada=no')).toBeNull();
  });

  it('el script del <head> funciona solo, sin imports', () => {
    const attrs: Record<string, string> = {};
    const doc = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
    new Function('document', 'location', SCRIPT_TEMPORADA)(doc, { search: '?temporada=halloween' });
    expect(attrs['data-temporada']).toBe('halloween');
  });
});
