import { describe, expect, it } from 'vitest';
import { revisarLlegadas, tituloConAviso, VIGIA_INICIAL } from './vigia-pedidos';

const p = (id: string, hora: string) => ({ id, created_at: `2026-11-02T${hora}:00.000Z` });

describe('revisarLlegadas', () => {
  it('la primera consulta solo marca el punto de partida: no avisa por pedidos viejos', () => {
    const r = revisarLlegadas([p('a', '18:00'), p('b', '18:05')], VIGIA_INICIAL);
    expect(r.nuevos).toEqual([]);
    expect(r.estado.marca).toBe('2026-11-02T18:05:00.000Z');
  });

  it('avisa solo por lo que llegó después, del más viejo al más nuevo', () => {
    const inicio = revisarLlegadas([p('a', '18:00')], VIGIA_INICIAL).estado;
    const r = revisarLlegadas([p('c', '18:20'), p('b', '18:10'), p('a', '18:00')], inicio);
    expect(r.nuevos.map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('no repite el aviso de un pedido ya visto', () => {
    let e = revisarLlegadas([p('a', '18:00')], VIGIA_INICIAL).estado;
    e = revisarLlegadas([p('b', '18:10'), p('a', '18:00')], e).estado;
    const otra = revisarLlegadas([p('b', '18:10'), p('a', '18:00')], e);
    expect(otra.nuevos).toEqual([]);
  });

  it('dos pedidos con la misma hora cuentan los dos', () => {
    let e = revisarLlegadas([p('a', '18:00')], VIGIA_INICIAL).estado;
    const r1 = revisarLlegadas([p('b', '18:10'), p('a', '18:00')], e);
    e = r1.estado;
    const r2 = revisarLlegadas([p('c', '18:10'), p('b', '18:10'), p('a', '18:00')], e);
    expect(r1.nuevos.map((x) => x.id)).toEqual(['b']);
    expect(r2.nuevos.map((x) => x.id)).toEqual(['c']);
  });

  it('con el panel vacío al abrir, el primer pedido que entre sí suena', () => {
    const e = revisarLlegadas([], VIGIA_INICIAL).estado;
    const r = revisarLlegadas([p('a', '19:00')], e);
    expect(r.nuevos.map((x) => x.id)).toEqual(['a']);
  });
});

describe('tituloConAviso', () => {
  it('antepone el número solo si hay pedidos sin atender', () => {
    expect(tituloConAviso('Panel', 0)).toBe('Panel');
    expect(tituloConAviso('Panel', 2)).toBe('(2) Nuevo pedido · Panel');
  });
});
