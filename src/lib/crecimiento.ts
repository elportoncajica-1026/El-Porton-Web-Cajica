/* =============================================================
 * PANEL "CRECIMIENTO" — cálculos puros (sin red), para poder probarlos
 *
 * Qué funciona, cómo funciona y qué no: de dónde llega la gente, dónde
 * se cae en el embudo, qué anuncio trae pedidos y quién vuelve.
 *
 * Todo en hora de Bogotá (UTC−5 fija, sin horario de verano).
 * ============================================================= */

import type { LineaPedidoGuardada } from './pedidos-admin';
import { nombreFuente, type OrigenPedido, type Toque } from './rastreo';

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
const DESFASE_MS = 5 * HORA_MS;

export type PedidoCr = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  payment_method: string | null;
  cash_change: string | null;
  subtotal: number;
  items: LineaPedidoGuardada[] | null;
  status: string;
  origen?: OrigenPedido | null;
};

export type EventoCr = { type: string; created_at: string; meta: Record<string, unknown> | null };

export type Rango = { desde: number; hasta: number };

const ms = (iso: string) => new Date(iso).getTime();
const enRango = (iso: string, r: Rango) => {
  const t = ms(iso);
  return t >= r.desde && t < r.hasta;
};
const vale = (p: PedidoCr) => p.status !== 'cancelado';

/** El periodo pedido (últimos `dias`, hasta ahora) y el anterior, del mismo largo. */
export function periodos(dias: number, ahora: number): { actual: Rango; anterior: Rango } {
  const actual = { desde: ahora - dias * DIA_MS, hasta: ahora };
  return { actual, anterior: { desde: actual.desde - dias * DIA_MS, hasta: actual.desde } };
}

/** Teléfono comparable: solo dígitos y sin el 57 delante. */
export function normTel(tel: string): string {
  return (tel || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
}

/** "300 •••• 42": para listas donde no hace falta el número completo. */
export function telOculto(tel: string): string {
  const d = normTel(tel);
  return d.length < 5 ? '•••' : `${d.slice(0, 3)} •••• ${d.slice(-2)}`;
}

/* ---------- etiqueta de origen (la fila del comparador) ---------- */

export const SIN_DATO = 'Sin dato';

/** El anuncio si lo hay; si no, la red. */
export function etiquetaToque(t: Pick<Toque, 'fuente' | 'anuncio'> | null | undefined): string {
  if (!t || !t.fuente) return SIN_DATO;
  return t.anuncio || nombreFuente(t.fuente);
}

function etiquetaEvento(e: EventoCr): string {
  const m = e.meta ?? {};
  const fuente = typeof m.fuente === 'string' ? m.fuente : null;
  const anuncio = typeof m.anuncio === 'string' ? m.anuncio : null;
  return etiquetaToque(fuente ? { fuente, anuncio } : null);
}

export const etiquetaPedido = (p: PedidoCr) => etiquetaToque(p.origen?.ultimo);

/** Identifica la visita de un evento. Los eventos viejos (sin visita) cuentan cada uno aparte. */
const claveVisita = (e: EventoCr, i: number) => (typeof e.meta?.sid === 'string' ? e.meta.sid : `e${i}`);
const clavePersona = (e: EventoCr, i: number) => (typeof e.meta?.vid === 'string' ? e.meta.vid : `e${i}`);

/* ---------- resumen ---------- */

export type Resumen = {
  personas: number;
  pedidos: number;
  ingreso: number;
  ticket: number;
  conversion: number | null;
  nuevos: number;
  recurrentes: number;
};

/** Primer pedido (válido) de cada teléfono, en ms. */
function primerosPedidos(todos: PedidoCr[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of todos) {
    if (!vale(p)) continue;
    const tel = normTel(p.customer_phone);
    if (!tel) continue;
    const t = ms(p.created_at);
    if (!m.has(tel) || t < m.get(tel)!) m.set(tel, t);
  }
  return m;
}

export function resumen(todos: PedidoCr[], eventos: EventoCr[], r: Rango): Resumen {
  const del = todos.filter((p) => vale(p) && enRango(p.created_at, r));
  const ingreso = del.reduce((s, p) => s + (Number(p.subtotal) || 0), 0);
  const personas = new Set(
    eventos.filter((e) => e.type === 'page_view' && enRango(e.created_at, r)).map(clavePersona),
  ).size;
  const primeros = primerosPedidos(todos);
  const clientes = new Set(del.map((p) => normTel(p.customer_phone)).filter(Boolean));
  let nuevos = 0;
  for (const tel of clientes) if ((primeros.get(tel) ?? 0) >= r.desde) nuevos++;
  return {
    personas,
    pedidos: del.length,
    ingreso,
    ticket: del.length ? Math.round(ingreso / del.length) : 0,
    conversion: personas ? del.length / personas : null,
    nuevos,
    recurrentes: clientes.size - nuevos,
  };
}

/** Variación porcentual redondeada; null si antes fue 0. */
export function cambio(ahora: number, antes: number): number | null {
  if (!antes) return null;
  return Math.round(((ahora - antes) / antes) * 100);
}

/* ---------- embudo ---------- */

export const PASOS_EMBUDO = [
  { tipo: 'page_view', texto: 'Entró a la web' },
  { tipo: 'view_item', texto: 'Abrió un plato' },
  { tipo: 'add_to_cart', texto: 'Agregó al carrito' },
  { tipo: 'checkout_opened', texto: 'Abrió el carrito' },
  { tipo: 'order_sent', texto: 'Envió el pedido' },
] as const;

/** Visitas distintas en cada paso. `filtro` = etiqueta de origen, o null para todas. */
export function embudo(eventos: EventoCr[], r: Rango, filtro: string | null): number[] {
  const sets = PASOS_EMBUDO.map(() => new Set<string>());
  eventos.forEach((e, i) => {
    if (!enRango(e.created_at, r)) return;
    if (filtro && etiquetaEvento(e) !== filtro) return;
    const k = PASOS_EMBUDO.findIndex((p) => p.tipo === e.type);
    if (k >= 0) sets[k].add(claveVisita(e, i));
  });
  return sets.map((s) => s.size);
}

/** Índice del paso con la peor tasa de paso (la mayor fuga), o -1. */
export function mayorFuga(valores: number[]): number {
  let peor = -1;
  let tasa = Infinity;
  for (let i = 1; i < valores.length; i++) {
    if (!valores[i - 1]) continue;
    const t = valores[i] / valores[i - 1];
    if (t < tasa) {
      tasa = t;
      peor = i;
    }
  }
  return peor;
}

/* ---------- comparador de anuncios ---------- */

export type FilaOrigen = {
  etiqueta: string;
  personas: number;
  carritos: number;
  pedidos: number;
  ventas: number;
  conversion: number | null;
};

export function porOrigen(todos: PedidoCr[], eventos: EventoCr[], r: Rango): FilaOrigen[] {
  const m = new Map<string, { personas: Set<string>; carritos: Set<string>; pedidos: number; ventas: number }>();
  const fila = (k: string) => {
    if (!m.has(k)) m.set(k, { personas: new Set(), carritos: new Set(), pedidos: 0, ventas: 0 });
    return m.get(k)!;
  };
  eventos.forEach((e, i) => {
    if (!enRango(e.created_at, r)) return;
    if (e.type === 'page_view') fila(etiquetaEvento(e)).personas.add(clavePersona(e, i));
    if (e.type === 'add_to_cart') fila(etiquetaEvento(e)).carritos.add(claveVisita(e, i));
  });
  for (const p of todos) {
    if (!vale(p) || !enRango(p.created_at, r)) continue;
    const f = fila(etiquetaPedido(p));
    f.pedidos++;
    f.ventas += Number(p.subtotal) || 0;
  }
  return [...m.entries()]
    .map(([etiqueta, f]) => ({
      etiqueta,
      personas: f.personas.size,
      carritos: f.carritos.size,
      pedidos: f.pedidos,
      ventas: f.ventas,
      conversion: f.personas.size ? f.pedidos / f.personas.size : null,
    }))
    .sort((a, b) => b.pedidos - a.pedidos || b.personas - a.personas || a.etiqueta.localeCompare(b.etiqueta));
}

/** Pedidos por día (Bogotá) de cada etiqueta, para la gráfica de líneas. */
export function seriePorDia(todos: PedidoCr[], r: Rango, etiquetas: string[]): { dias: string[]; series: number[][] } {
  // Del día de `desde` al día de `hasta` (incluido hoy), en fechas de Bogotá.
  const unicos: string[] = [];
  const fin = diaBogota(r.hasta - 1);
  for (let t = r.desde; unicos[unicos.length - 1] !== fin && unicos.length < 400; t += DIA_MS) {
    const d = diaBogota(Math.min(t, r.hasta - 1));
    if (unicos[unicos.length - 1] !== d) unicos.push(d);
  }
  const idx = new Map(unicos.map((d, i) => [d, i]));
  const series = etiquetas.map(() => unicos.map(() => 0));
  for (const p of todos) {
    if (!vale(p) || !enRango(p.created_at, r)) continue;
    const k = etiquetas.indexOf(etiquetaPedido(p));
    const d = idx.get(diaBogota(ms(p.created_at)));
    if (k >= 0 && d !== undefined) series[k][d]++;
  }
  return { dias: unicos, series };
}

/* ---------- clientes ---------- */

export type Cliente = {
  tel: string;
  nombre: string;
  pedidos: PedidoCr[]; // del más reciente al más viejo
  primero: Toque | null; // por dónde llegó la primera vez que se registró
  total: number;
  ultimo: number;
  promos: boolean;
};

/** Un cliente por teléfono, con todos sus pedidos válidos. */
export function clientes(todos: PedidoCr[]): Cliente[] {
  const m = new Map<string, PedidoCr[]>();
  for (const p of todos) {
    if (!vale(p)) continue;
    const tel = normTel(p.customer_phone);
    if (!tel) continue;
    if (!m.has(tel)) m.set(tel, []);
    m.get(tel)!.push(p);
  }
  return [...m.entries()]
    .map(([tel, ps]) => {
      ps.sort((a, b) => ms(b.created_at) - ms(a.created_at));
      const conOrigen = [...ps].reverse().find((p) => p.origen?.primero || p.origen?.ultimo);
      return {
        tel,
        nombre: ps[0].customer_name,
        pedidos: ps,
        primero: conOrigen?.origen?.primero ?? conOrigen?.origen?.ultimo ?? null,
        total: ps.reduce((s, p) => s + (Number(p.subtotal) || 0), 0),
        ultimo: ms(ps[0].created_at),
        promos: ps[0].origen?.promos === true,
      };
    })
    .sort((a, b) => b.ultimo - a.ultimo);
}

/** Pidieron antes y llevan más de `dias` sin volver. Los que más pedían primero. */
export function dormidos(lista: Cliente[], ahora: number, dias = 30): Cliente[] {
  return lista
    .filter((c) => ahora - c.ultimo > dias * DIA_MS)
    .sort((a, b) => b.pedidos.length - a.pedidos.length || b.ultimo - a.ultimo);
}

/** Lo que más pide un cliente (por cantidad). */
export function platoFavorito(c: Cliente): string {
  const m = new Map<string, number>();
  for (const p of c.pedidos) for (const it of p.items ?? []) m.set(it.name, (m.get(it.name) ?? 0) + (it.qty || 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
}

/** Clientes nuevos y recurrentes en cada una de las últimas `semanas` (de 7 días, terminando ahora). */
export function semanas(todos: PedidoCr[], ahora: number, cuantas = 6): { nuevos: number[]; recurrentes: number[] } {
  const primeros = primerosPedidos(todos);
  const nuevos: number[] = [];
  const recurrentes: number[] = [];
  for (let w = cuantas - 1; w >= 0; w--) {
    const r = { desde: ahora - (w + 1) * 7 * DIA_MS, hasta: ahora - w * 7 * DIA_MS };
    const tels = new Set(
      todos.filter((p) => vale(p) && enRango(p.created_at, r)).map((p) => normTel(p.customer_phone)).filter(Boolean),
    );
    let n = 0;
    for (const t of tels) if ((primeros.get(t) ?? 0) >= r.desde) n++;
    nuevos.push(n);
    recurrentes.push(tels.size - n);
  }
  return { nuevos, recurrentes };
}

/* ---------- platos ---------- */

export type FilaPlato = { id: string; nombre: string; vistas: number; pedidos: number };

/** Vistas (abrió el plato) contra unidades pedidas, por plato. */
export function platos(todos: PedidoCr[], eventos: EventoCr[], r: Rango, nombres: Map<string, string>): FilaPlato[] {
  const m = new Map<string, FilaPlato>();
  const fila = (id: string, nombre?: string) => {
    if (!m.has(id)) m.set(id, { id, nombre: nombres.get(id) ?? nombre ?? id, vistas: 0, pedidos: 0 });
    return m.get(id)!;
  };
  for (const e of eventos) {
    if (e.type !== 'view_item' || !enRango(e.created_at, r)) continue;
    const id = e.meta?.id;
    if (typeof id === 'string' && id) fila(id).vistas++;
  }
  for (const p of todos) {
    if (!vale(p) || !enRango(p.created_at, r)) continue;
    for (const it of p.items ?? []) fila(it.id || it.name, it.name).pedidos += it.qty || 1;
  }
  return [...m.values()].sort((a, b) => b.vistas - a.vistas || b.pedidos - a.pedidos);
}

/* ---------- "¿cómo nos conociste?" ---------- */

export function conocio(todos: PedidoCr[], r: Rango): { valor: string; n: number }[] {
  const m = new Map<string, number>();
  for (const p of todos) {
    if (!vale(p) || !enRango(p.created_at, r)) continue;
    const v = p.origen?.conocio;
    if (v) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].map(([valor, n]) => ({ valor, n })).sort((a, b) => b.n - a.n);
}

/* ---------- horarios ---------- */

/** Días en el orden del negocio (abre de martes a domingo; lunes al final). */
export const DIAS_SEMANA = ['Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom', 'Lun'];
export const HORAS = [13, 14, 15, 16, 17, 18, 19, 20, 21];

export function diaBogota(t: number): string {
  return new Date(t - DESFASE_MS).toISOString().slice(0, 10);
}

/** Pedidos por día de la semana × hora (Bogotá). Filas en el orden de DIAS_SEMANA. */
export function calorHorario(todos: PedidoCr[], r: Rango): number[][] {
  const m = DIAS_SEMANA.map(() => HORAS.map(() => 0));
  for (const p of todos) {
    if (!vale(p) || !enRango(p.created_at, r)) continue;
    const local = new Date(ms(p.created_at) - DESFASE_MS);
    const fila = (local.getUTCDay() + 5) % 7; // martes = 0 … lunes = 6
    const h = Math.min(Math.max(local.getUTCHours(), HORAS[0]), HORAS[HORAS.length - 1]);
    m[fila][HORAS.indexOf(h)]++;
  }
  return m;
}
