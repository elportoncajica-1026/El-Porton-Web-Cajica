import { describe, it, expect } from 'vitest';
import { MENU } from '@/data/menu';
import { corregirElecciones, permitidas } from '@/lib/modal';

const gaseosa = MENU.find((p) => p.id === 'b-gaseosa')!;
const idx = (label: string) => gaseosa.options.findIndex((o) => o.label === label);
const sabor = (e: number[]) => gaseosa.choices![0].options[e[0]];

describe('gaseosa: sabores por tamaño', () => {
  it('en lata solo hay Coca-Cola', () => {
    expect(permitidas(gaseosa, idx('Lata'))).toEqual(['Coca-Cola']);
  });
  it('la Kola Román solo viene en 400ml', () => {
    for (const t of ['Lata', '1.5 Lt']) expect(permitidas(gaseosa, idx(t))).not.toContain('Kola Román');
    expect(permitidas(gaseosa, idx('400ml'))).toContain('Kola Román');
  });
  it('al pasar a lata con Sprite elegido, cambia a Coca-Cola', () => {
    const sprite = gaseosa.choices![0].options.indexOf('Sprite');
    expect(sabor(corregirElecciones(gaseosa, idx('Lata'), [sprite]))).toBe('Coca-Cola');
  });
  it('si el sabor existe en el tamaño, no lo toca', () => {
    const zero = gaseosa.choices![0].options.indexOf('Coca-Cola Zero');
    expect(sabor(corregirElecciones(gaseosa, idx('1.5 Lt'), [zero]))).toBe('Coca-Cola Zero');
  });
  it('productos sin restricción: todas las opciones valen', () => {
    const jugo = MENU.find((p) => p.id === 'b-jugo-valle')!;
    expect(permitidas(jugo, 0)).toBeNull();
  });
});
