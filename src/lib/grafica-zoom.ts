/* =============================================================
 * ZOOM DE LA GRÁFICA DE VENTAS (lógica pura)
 *
 * Al tocar un punto de la gráfica del inicio se baja un nivel:
 *   año → sus meses → un mes → sus días → un día → sus horas.
 * Aquí se decide qué rango de pedidos pedir y cómo agruparlos.
 * Bogotá no tiene horario de verano: siempre es UTC-5.
 * ============================================================= */

import type { PuntoSerie } from '@/lib/ventas';

/** Qué representa cada punto de la gráfica. */
export type GranPunto = 'anio' | 'mes' | 'dia' | 'hora';

/** Un nivel de zoom: qué se muestra (gran) y de qué periodo (clave). */
export type Zoom = { gran: Exclude<GranPunto, 'anio'>; clave: string };

const OFFSET_MS = 5 * 3600 * 1000;
const dos = (n: number) => String(n).padStart(2, '0');

export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Hora de Bogotá de un instante, como fecha "UTC" para leer sus partes con getUTC*. */
const enBogota = (iso: string) => new Date(Date.parse(iso) - OFFSET_MS);
const hoyBogota = (ahora: Date) => new Date(ahora.getTime() - OFFSET_MS);

/** Al tocar un punto de este tipo, a qué nivel se baja (null = ya es el más fino). */
export function siguienteNivel(gran: GranPunto, inicio: string): Zoom | null {
  if (gran === 'anio') return { gran: 'mes', clave: inicio.slice(0, 4) };
  if (gran === 'mes') return { gran: 'dia', clave: inicio.slice(0, 7) };
  if (gran === 'dia') return { gran: 'hora', clave: inicio.slice(0, 10) };
  return null;
}

/** Rango [desde, hasta) en ISO con la zona de Bogotá, para filtrar `orders`. */
export function rangoDe(z: Zoom): { desde: string; hasta: string } {
  const t = (fecha: string) => `${fecha}T00:00:00-05:00`;
  if (z.gran === 'mes') {
    const y = Number(z.clave);
    return { desde: t(`${y}-01-01`), hasta: t(`${y + 1}-01-01`) };
  }
  if (z.gran === 'dia') {
    const [y, m] = z.clave.split('-').map(Number);
    const sig = m === 12 ? `${y + 1}-01-01` : `${y}-${dos(m + 1)}-01`;
    return { desde: t(`${z.clave}-01`), hasta: t(sig) };
  }
  const [y, m, d] = z.clave.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, d + 1));
  return { desde: t(z.clave), hasta: t(`${s.getUTCFullYear()}-${dos(s.getUTCMonth() + 1)}-${dos(s.getUTCDate())}`) };
}

type PedidoMin = { created_at: string; subtotal: number };

/** Horas que se muestran siempre en el detalle de un día (el local abre de 1 a 10 p.m.). */
const HORAS_BASE = Array.from({ length: 12 }, (_, k) => 12 + k); // 12:00 a 23:00

/**
 * Agrupa los pedidos (ya sin cancelados) en los puntos del nivel pedido.
 * Los periodos sin ventas salen en 0; los que todavía no han llegado (meses
 * o días futuros) no se muestran. Los pedidos fuera del periodo se ignoran.
 */
export function agrupar(z: Zoom, pedidos: PedidoMin[], ahora = new Date()): PuntoSerie[] {
  const hoy = hoyBogota(ahora);
  const suma = new Map<string, PuntoSerie>();
  const punto = (inicio: string) => {
    let p = suma.get(inicio);
    if (!p) { p = { inicio, ingreso: 0, pedidos: 0 }; suma.set(inicio, p); }
    return p;
  };

  if (z.gran === 'mes') {
    const y = Number(z.clave);
    const ultimo = y < hoy.getUTCFullYear() ? 12 : y === hoy.getUTCFullYear() ? hoy.getUTCMonth() + 1 : 0;
    for (let m = 1; m <= ultimo; m++) punto(`${y}-${dos(m)}-01`);
    for (const o of pedidos) { const b = enBogota(o.created_at); if (b.getUTCFullYear() !== y) continue; const p = punto(`${y}-${dos(b.getUTCMonth() + 1)}-01`); p.ingreso += Number(o.subtotal); p.pedidos++; }
  } else if (z.gran === 'dia') {
    const [y, m] = z.clave.split('-').map(Number);
    const enMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const esActual = y === hoy.getUTCFullYear() && m === hoy.getUTCMonth() + 1;
    const futuro = y > hoy.getUTCFullYear() || (y === hoy.getUTCFullYear() && m > hoy.getUTCMonth() + 1);
    const ultimo = futuro ? 0 : esActual ? hoy.getUTCDate() : enMes;
    for (let d = 1; d <= ultimo; d++) punto(`${z.clave}-${dos(d)}`);
    for (const o of pedidos) { const b = enBogota(o.created_at); if (b.getUTCFullYear() !== y || b.getUTCMonth() + 1 !== m) continue; const p = punto(`${z.clave}-${dos(b.getUTCDate())}`); p.ingreso += Number(o.subtotal); p.pedidos++; }
  } else {
    for (const h of HORAS_BASE) punto(`${z.clave}T${dos(h)}`);
    for (const o of pedidos) { const b = enBogota(o.created_at); if (b.toISOString().slice(0, 10) !== z.clave) continue; const p = punto(`${z.clave}T${dos(b.getUTCHours())}`); p.ingreso += Number(o.subtotal); p.pedidos++; }
  }
  return [...suma.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Suma meses en años (la base de datos agrupa por día, semana o mes). */
export function porAnio(meses: PuntoSerie[], ahora = new Date()): PuntoSerie[] {
  const m = new Map<string, PuntoSerie>();
  for (const p of meses) {
    const y = String(p.inicio).slice(0, 4);
    const a = m.get(y) ?? { inicio: `${y}-01-01`, ingreso: 0, pedidos: 0 };
    a.ingreso += Number(p.ingreso);
    a.pedidos += Number(p.pedidos);
    m.set(y, a);
  }
  const actual = String(hoyBogota(ahora).getUTCFullYear());
  return [...m.values()]
    .filter((a) => a.ingreso > 0 || a.pedidos > 0 || a.inicio.startsWith(actual))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Etiqueta corta del eje X. `muchos` = hay tantos puntos que conviene abreviar. */
export function etiquetaCorta(gran: GranPunto, inicio: string, muchos: boolean): string {
  if (gran === 'anio') return inicio.slice(0, 4);
  if (gran === 'mes') return `${MESES_CORTOS[Number(inicio.slice(5, 7)) - 1]} ${inicio.slice(2, 4)}`;
  if (gran === 'hora') return horaCorta(Number(inicio.slice(11, 13)));
  const [y, m, d] = inicio.split('-').map(Number);
  return muchos ? String(d) : `${DIAS_CORTOS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
}

/** Etiqueta completa para el detalle al pasar el dedo o el mouse. */
export function etiquetaLarga(gran: GranPunto, inicio: string): string {
  if (gran === 'anio') return `Año ${inicio.slice(0, 4)}`;
  if (gran === 'mes') return `${cap(MESES_LARGOS[Number(inicio.slice(5, 7)) - 1])} ${inicio.slice(0, 4)}`;
  const [y, m, d] = inicio.slice(0, 10).split('-').map(Number);
  const dia = `${cap(DIAS_LARGOS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()])} ${d} de ${MESES_LARGOS[m - 1]}`;
  if (gran === 'dia') return dia;
  const h = Number(inicio.slice(11, 13));
  return `${dia}, ${horaCorta(h)} – ${horaCorta((h + 1) % 24)}`;
}

/** Título de la gráfica cuando se está dentro de un zoom. */
export function tituloZoom(z: Zoom): string {
  if (z.gran === 'mes') return `Ventas de ${z.clave} · por mes`;
  if (z.gran === 'dia') {
    const [y, m] = z.clave.split('-').map(Number);
    return `Ventas de ${MESES_LARGOS[m - 1]} ${y} · por día`;
  }
  return `Ventas del ${etiquetaLarga('dia', z.clave).toLowerCase()} · por hora`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function horaCorta(h: number): string {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}
