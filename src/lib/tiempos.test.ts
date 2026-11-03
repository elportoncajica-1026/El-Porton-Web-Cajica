import { describe, expect, it } from 'vitest';
import { TIEMPOS_POR_DEFECTO, erroresTiempos, normalizarTiempos, textoRango } from './tiempos';

describe('normalizarTiempos', () => {
  it('sin nada guardado usa los de por defecto (40–50 domicilio, 15–20 los demás)', () => {
    expect(normalizarTiempos(null)).toEqual(TIEMPOS_POR_DEFECTO);
    expect(normalizarTiempos('basura')).toEqual(TIEMPOS_POR_DEFECTO);
  });

  it('usa lo guardado cuando es válido', () => {
    const t = normalizarTiempos({ domicilio: { min: 30, max: 45 }, recoger: { min: 10, max: 15 }, restaurante: { min: 20, max: 25 } });
    expect(t).toEqual({ domicilio: { min: 30, max: 45 }, recoger: { min: 10, max: 15 }, restaurante: { min: 20, max: 25 } });
  });

  it('un tipo dañado cae a su valor por defecto sin afectar a los otros', () => {
    const t = normalizarTiempos({ domicilio: { min: 60, max: 30 }, recoger: { min: '12', max: '18' } });
    expect(t.domicilio).toEqual(TIEMPOS_POR_DEFECTO.domicilio);
    expect(t.recoger).toEqual({ min: 12, max: 18 });
    expect(t.restaurante).toEqual(TIEMPOS_POR_DEFECTO.restaurante);
  });
});

describe('erroresTiempos', () => {
  it('acepta los de por defecto', () => {
    expect(erroresTiempos(TIEMPOS_POR_DEFECTO)).toEqual([]);
  });
  it('rechaza mínimo mayor que máximo, ceros, decimales y vacíos', () => {
    expect(erroresTiempos({ ...TIEMPOS_POR_DEFECTO, recoger: { min: 25, max: 20 } })[0]).toMatch(/mínimo/);
    expect(erroresTiempos({ ...TIEMPOS_POR_DEFECTO, domicilio: { min: 0, max: 50 } })).toHaveLength(1);
    expect(erroresTiempos({ ...TIEMPOS_POR_DEFECTO, domicilio: { min: 40.5, max: 50 } })).toHaveLength(1);
    expect(erroresTiempos({ ...TIEMPOS_POR_DEFECTO, restaurante: { min: '', max: 20 } })).toHaveLength(1);
  });
});

describe('textoRango', () => {
  it('se lee natural', () => {
    expect(textoRango({ min: 15, max: 20 })).toBe('15 a 20 minutos');
    expect(textoRango({ min: 30, max: 30 })).toBe('30 minutos');
  });
});
