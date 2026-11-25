import { describe, it, expect } from 'vitest';
import { agrupar, etiquetaCorta, etiquetaLarga, porAnio, rangoDe, siguienteNivel, tituloZoom } from '@/lib/grafica-zoom';

const AHORA = new Date('2026-11-25T18:00:00Z'); // 25 nov, 1 p.m. en Bogotá

describe('zoom de la gráfica', () => {
  it('cada nivel baja al siguiente y la hora es el último', () => {
    expect(siguienteNivel('anio', '2026-01-01')).toEqual({ gran: 'mes', clave: '2026' });
    expect(siguienteNivel('mes', '2026-11-01')).toEqual({ gran: 'dia', clave: '2026-11' });
    expect(siguienteNivel('dia', '2026-11-22')).toEqual({ gran: 'hora', clave: '2026-11-22' });
    expect(siguienteNivel('hora', '2026-11-22T19')).toBeNull();
  });

  it('los rangos usan la hora de Bogotá y el día siguiente cruza fin de mes y de año', () => {
    expect(rangoDe({ gran: 'dia', clave: '2026-12' })).toEqual({ desde: '2026-12-01T00:00:00-05:00', hasta: '2027-01-01T00:00:00-05:00' });
    expect(rangoDe({ gran: 'hora', clave: '2026-11-30' }).hasta).toBe('2026-12-01T00:00:00-05:00');
    expect(rangoDe({ gran: 'mes', clave: '2026' }).hasta).toBe('2027-01-01T00:00:00-05:00');
  });

  it('agrupa por mes sin mostrar meses futuros', () => {
    const r = agrupar({ gran: 'mes', clave: '2026' }, [
      { created_at: '2026-09-13T20:00:00-05:00', subtotal: 56000 },
      { created_at: '2026-11-22T19:36:00-05:00', subtotal: 66000 },
    ], AHORA);
    expect(r).toHaveLength(11); // enero a noviembre
    expect(r.find((p) => p.inicio === '2026-09-01')).toEqual({ inicio: '2026-09-01', ingreso: 56000, pedidos: 1 });
    expect(r.find((p) => p.inicio === '2026-12-01')).toBeUndefined();
  });

  it('un pedido a las 11 p.m. de Bogotá cuenta en ese día, no en el siguiente', () => {
    const r = agrupar({ gran: 'dia', clave: '2026-11' }, [{ created_at: '2026-11-21T04:30:00Z', subtotal: 10000 }], AHORA);
    expect(r.find((p) => p.inicio === '2026-11-20')?.ingreso).toBe(10000);
    expect(r).toHaveLength(25); // hasta hoy, 25 nov
  });

  it('el detalle por hora muestra el horario del local y suma la hora del pedido', () => {
    const r = agrupar({ gran: 'hora', clave: '2026-11-22' }, [{ created_at: '2026-11-22T19:36:00-05:00', subtotal: 66000 }], AHORA);
    expect(r[0].inicio).toBe('2026-11-22T12');
    expect(r.find((p) => p.inicio === '2026-11-22T19')?.pedidos).toBe(1);
  });

  it('ignora pedidos de otros días aunque lleguen en la lista', () => {
    const r = agrupar({ gran: 'hora', clave: '2026-11-22' }, [
      { created_at: '2026-11-22T19:36:00-05:00', subtotal: 66000 },
      { created_at: '2026-11-16T16:59:00-05:00', subtotal: 85000 },
    ], AHORA);
    expect(r.reduce((s, p) => s + p.ingreso, 0)).toBe(66000);
  });

  it('por año suma los meses', () => {
    expect(porAnio([{ inicio: '2026-09-01', ingreso: 56000, pedidos: 1 }, { inicio: '2026-11-01', ingreso: 790800, pedidos: 13 }], AHORA))
      .toEqual([{ inicio: '2026-01-01', ingreso: 846800, pedidos: 14 }]);
  });

  it('etiquetas legibles', () => {
    expect(etiquetaCorta('mes', '2026-11-01', false)).toBe('nov 26');
    expect(etiquetaCorta('hora', '2026-11-22T19', false)).toBe('7pm');
    expect(etiquetaCorta('dia', '2026-11-22', false)).toBe('dom 22');
    expect(etiquetaLarga('hora', '2026-11-22T19')).toBe('Domingo 22 de noviembre, 7pm – 8pm');
    expect(tituloZoom({ gran: 'dia', clave: '2026-11' })).toBe('Ventas de noviembre 2026 · por día');
  });
});
