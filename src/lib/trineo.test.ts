import { describe, expect, it } from 'vitest';
import { colaTrineo, posTrineo, PROPORCION_TRINEO, type RutaTrineo } from './trineo';

const ruta = (extra: Partial<RutaTrineo> = {}): RutaTrineo => ({
  W: 1200,
  ancho: 300,
  y0: 400,
  y1: 200,
  ondas: 1,
  amp: 30,
  haciaDerecha: true,
  ...extra,
});

describe('posTrineo', () => {
  it('entra y sale totalmente fuera de cuadro (no aparece de golpe)', () => {
    const r = ruta();
    expect(posTrineo(0, r).x + r.ancho).toBeLessThanOrEqual(0);
    expect(posTrineo(1, r).x).toBeGreaterThanOrEqual(r.W);
  });

  it('hacia la izquierda hace el recorrido al revés', () => {
    const r = ruta({ haciaDerecha: false });
    expect(posTrineo(0, r).x).toBeGreaterThanOrEqual(r.W);
    expect(posTrineo(1, r).x + r.ancho).toBeLessThanOrEqual(0);
  });

  it('avanza siempre en la misma dirección', () => {
    const r = ruta();
    let antes = -Infinity;
    for (let i = 0; i <= 50; i++) {
      const { x } = posTrineo(i / 50, r);
      expect(x).toBeGreaterThan(antes);
      antes = x;
    }
  });

  it('no se sale de su franja de altura', () => {
    const r = ruta();
    for (let i = 0; i <= 100; i++) {
      const { y } = posTrineo(i / 100, r);
      expect(y).toBeGreaterThanOrEqual(Math.min(r.y0, r.y1) - r.amp - 0.001);
      expect(y).toBeLessThanOrEqual(Math.max(r.y0, r.y1) + r.amp + 0.001);
    }
  });

  it('se inclina poco (máximo 14°) y en espejo según la dirección', () => {
    for (let i = 0; i <= 40; i++) {
      const p = i / 40;
      const der = posTrineo(p, ruta());
      const izq = posTrineo(p, ruta({ haciaDerecha: false }));
      expect(Math.abs(der.r)).toBeLessThanOrEqual(14);
      expect(izq.r).toBeCloseTo(-der.r, 6);
    }
  });

  it('subiendo, la nariz apunta arriba (giro antihorario si va a la derecha)', () => {
    const r = ruta({ amp: 0, y0: 600, y1: 100 });
    expect(posTrineo(0.5, r).r).toBeLessThan(0);
  });

  it('acepta avances fuera de rango sin romperse', () => {
    const r = ruta();
    expect(posTrineo(-1, r)).toEqual(posTrineo(0, r));
    expect(posTrineo(2, r)).toEqual(posTrineo(1, r));
  });
});

describe('colaTrineo', () => {
  it('las chispas salen de atrás y abajo (el patín)', () => {
    const pos = { x: 100, y: 50, r: 0 };
    const der = colaTrineo(pos, 300, true);
    const izq = colaTrineo(pos, 300, false);
    expect(der.x).toBeLessThan(100 + 300 * 0.1);
    expect(izq.x).toBeGreaterThan(100 + 300 * 0.9);
    expect(der.y).toBeGreaterThan(50 + 300 * PROPORCION_TRINEO * 0.7);
  });
});
