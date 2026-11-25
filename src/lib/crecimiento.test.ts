import { describe, expect, it } from 'vitest';
import {
  calorHorario,
  cambio,
  clientes,
  conocio,
  dormidos,
  embudo,
  etiquetaToque,
  mayorFuga,
  normTel,
  periodos,
  platos,
  porOrigen,
  resumen,
  semanas,
  seriePorDia,
  telOculto,
  type EventoCr,
  type PedidoCr,
} from './crecimiento';

const AHORA = Date.UTC(2026, 10, 25, 23, 0); // 25 nov, 6 p.m. en Bogotá
const DIA = 86_400_000;
const hace = (dias: number, horas = 0) => new Date(AHORA - dias * DIA - horas * 3_600_000).toISOString();

let n = 0;
function pedido(p: Partial<PedidoCr> & { tel: string; dias: number }): PedidoCr {
  const { tel, dias, ...resto } = p;
  return {
    id: String(++n),
    created_at: hace(dias),
    customer_name: 'Cliente',
    customer_phone: tel,
    customer_address: 'Calle 1',
    payment_method: 'Efectivo',
    cash_change: null,
    subtotal: 10000,
    items: [{ id: 'h-clasica', name: 'Clásica', qty: 1 }],
    status: 'entregado',
    origen: null,
    ...resto,
  };
}
const ev = (type: string, dias: number, meta: Record<string, unknown>): EventoCr => ({ type, created_at: hace(dias), meta });
const meta = (sid: string, anuncio: string | null = null, extra = {}) => ({
  sid,
  vid: 'v' + sid,
  fuente: anuncio ? 'meta' : 'directo',
  anuncio,
  ...extra,
});
const toque = (anuncio: string | null, fuente = 'meta') => ({ fuente, campana: null, anuncio, ts: 0 });

const { actual } = periodos(30, AHORA);

describe('teléfonos', () => {
  it('compara sin el 57 ni símbolos', () => {
    expect(normTel('+57 300-123-4567')).toBe('3001234567');
    expect(normTel('3001234567')).toBe('3001234567');
  });
  it('oculta el número en las listas', () => {
    expect(telOculto('3001234567')).toBe('300 •••• 67');
  });
});

describe('resumen', () => {
  const todos = [
    pedido({ tel: '3001', dias: 60 }), // cliente viejo
    pedido({ tel: '3001', dias: 5 }), // vuelve: recurrente
    pedido({ tel: '3002', dias: 3, subtotal: 30000 }), // nuevo
    pedido({ tel: '3003', dias: 2, status: 'cancelado' }), // no cuenta
  ];
  const eventos = [ev('page_view', 3, meta('a')), ev('page_view', 2, meta('b')), ev('page_view', 1, meta('b'))];
  it('cuenta pedidos válidos, ingreso, nuevos y recurrentes del periodo', () => {
    const r = resumen(todos, eventos, actual);
    expect(r).toMatchObject({ pedidos: 2, ingreso: 40000, ticket: 20000, nuevos: 1, recurrentes: 1, personas: 2 });
    expect(r.conversion).toBe(1);
  });
  it('variación', () => {
    expect(cambio(12, 10)).toBe(20);
    expect(cambio(5, 0)).toBeNull();
  });
});

describe('embudo y origen', () => {
  const eventos = [
    ev('page_view', 1, meta('s1', 'a-antojo')),
    ev('view_item', 1, meta('s1', 'a-antojo', { id: 'h-clasica' })),
    ev('view_item', 1, meta('s1', 'a-antojo', { id: 'h-clasica' })), // misma visita: cuenta una
    ev('add_to_cart', 1, meta('s1', 'a-antojo')),
    ev('page_view', 1, meta('s2')),
    ev('page_view', 40, meta('viejo')), // fuera del periodo
    { type: 'add_to_cart', created_at: hace(1), meta: null }, // evento viejo sin visita
  ];
  it('cuenta visitas distintas por paso', () => {
    expect(embudo(eventos, actual, null)).toEqual([2, 1, 2, 0, 0]);
    expect(embudo(eventos, actual, 'a-antojo')).toEqual([1, 1, 1, 0, 0]);
  });
  it('encuentra la mayor fuga', () => {
    expect(mayorFuga([100, 60, 20, 15, 10])).toBe(2);
    expect(mayorFuga([0, 0])).toBe(-1);
  });
  it('etiqueta: el anuncio si hay, si no la red', () => {
    expect(etiquetaToque(toque('b-portavoz'))).toBe('b-portavoz');
    expect(etiquetaToque(toque(null, 'instagram.com'))).toBe('Instagram');
    expect(etiquetaToque(null)).toBe('Sin dato');
  });
  it('compara anuncios con pedidos y ventas', () => {
    const todos = [
      pedido({ tel: '1', dias: 1, subtotal: 20000, origen: { primero: null, ultimo: toque('a-antojo'), conocio: null, promos: false, autorizacion: 'x' } }),
      pedido({ tel: '2', dias: 1 }),
    ];
    const filas = porOrigen(todos, eventos, actual);
    const a = filas.find((f) => f.etiqueta === 'a-antojo')!;
    expect(a).toMatchObject({ personas: 1, carritos: 1, pedidos: 1, ventas: 20000, conversion: 1 });
    expect(filas.find((f) => f.etiqueta === 'Sin dato')!.pedidos).toBe(1);
  });
  it('serie diaria por etiqueta', () => {
    const todos = [pedido({ tel: '1', dias: 0.1 }), pedido({ tel: '2', dias: 0.2 })];
    const s = seriePorDia(todos, periodos(7, AHORA).actual, ['Sin dato']);
    expect(s.series[0].reduce((x, y) => x + y, 0)).toBe(2);
    expect(s.dias.length).toBeGreaterThanOrEqual(7);
  });
});

describe('clientes', () => {
  const todos = [
    pedido({ tel: '3001234567', dias: 45, customer_name: 'Ana', origen: { primero: toque('a'), ultimo: toque('a'), conocio: 'instagram', promos: false, autorizacion: 'x' } }),
    pedido({ tel: '+57 300 123 4567', dias: 40, customer_name: 'Ana María', origen: { primero: toque('a'), ultimo: toque('a'), conocio: null, promos: true, autorizacion: 'x' } }),
    pedido({ tel: '3002', dias: 2, customer_name: 'Luis' }),
  ];
  const lista = clientes(todos);
  it('agrupa por teléfono con el nombre más reciente', () => {
    expect(lista).toHaveLength(2);
    const ana = lista.find((c) => c.tel === '3001234567')!;
    expect(ana.nombre).toBe('Ana María');
    expect(ana.pedidos).toHaveLength(2);
    expect(ana.primero?.anuncio).toBe('a');
    expect(ana.promos).toBe(true);
  });
  it('dormidos: más de 30 días sin volver', () => {
    expect(dormidos(lista, AHORA).map((c) => c.tel)).toEqual(['3001234567']);
  });
  it('nuevos y recurrentes por semana', () => {
    const s = semanas([...todos, pedido({ tel: '3002', dias: 10 })], AHORA, 2);
    expect(s.nuevos).toEqual([1, 0]);
    expect(s.recurrentes).toEqual([0, 1]);
  });
  it('¿cómo nos conociste?', () => {
    expect(conocio(todos, periodos(60, AHORA).actual)).toEqual([{ valor: 'instagram', n: 1 }]);
  });
});

describe('platos y horarios', () => {
  it('vistas contra unidades pedidas', () => {
    const eventos = [ev('view_item', 1, meta('s', null, { id: 'h-clasica' })), ev('view_item', 1, meta('t', null, { id: 'p-perro' }))];
    const filas = platos([pedido({ tel: '1', dias: 1 })], eventos, actual, new Map([['p-perro', 'Perro']]));
    expect(filas.find((f) => f.id === 'h-clasica')).toMatchObject({ vistas: 1, pedidos: 1 });
    expect(filas.find((f) => f.id === 'p-perro')).toMatchObject({ nombre: 'Perro', vistas: 1, pedidos: 0 });
  });
  it('ubica los pedidos en día y hora de Bogotá', () => {
    // 25 nov 2026 (miércoles), 23:00 UTC = 6 p.m. en Bogotá
    const m = calorHorario([pedido({ tel: '1', dias: 0, created_at: new Date(AHORA).toISOString() })], { desde: 0, hasta: AHORA + 1 });
    expect(m[1][5]).toBe(1); // fila "Mié", columna 18 h
  });
});
