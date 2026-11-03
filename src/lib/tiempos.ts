/* =============================================================
 * TIEMPOS DE ENTREGA POR TIPO DE PEDIDO (lógica pura)
 *
 * Lo que el carrito promete: cuánto tarda un domicilio y cuánto un
 * pedido para recoger o para comer en el restaurante. Se editan desde
 * el panel (sección "Tiempos") y se guardan en la tabla `ajustes`
 * (db/ajustes-setup.sql). Si la tabla aún no existe o el valor viene
 * dañado, se usan los de por defecto: el carrito nunca se queda sin
 * aviso ni muestra algo absurdo.
 * ============================================================= */

import { TIPOS_PEDIDO, type TipoPedido } from '@/lib/tipo-pedido';

export type Rango = { min: number; max: number };
export type Tiempos = Record<TipoPedido, Rango>;

export const TIEMPOS_POR_DEFECTO: Tiempos = {
  domicilio: { min: 40, max: 50 },
  recoger: { min: 15, max: 20 },
  restaurante: { min: 15, max: 20 },
};

/** Límites razonables: ni 0 minutos ni más de 4 horas. */
export const MINUTOS_MIN = 1;
export const MINUTOS_MAX = 240;

const entero = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
};

/** Errores de un juego de tiempos (vacío = válido). */
export function erroresTiempos(t: Record<string, { min: unknown; max: unknown } | undefined>): string[] {
  const errores: string[] = [];
  const nombres: Record<TipoPedido, string> = { domicilio: 'Domicilio', recoger: 'Recoger', restaurante: 'En el restaurante' };
  for (const tipo of TIPOS_PEDIDO) {
    const r = t[tipo];
    const min = entero(r?.min);
    const max = entero(r?.max);
    if (min === null || max === null) {
      errores.push(`${nombres[tipo]}: escribe minutos en números enteros.`);
      continue;
    }
    if (min < MINUTOS_MIN || max > MINUTOS_MAX) errores.push(`${nombres[tipo]}: entre ${MINUTOS_MIN} y ${MINUTOS_MAX} minutos.`);
    else if (min > max) errores.push(`${nombres[tipo]}: el mínimo no puede ser mayor que el máximo.`);
  }
  return errores;
}

/** Toma lo guardado (entrada no fiable) y devuelve tiempos válidos, tipo por tipo. */
export function normalizarTiempos(crudo: unknown): Tiempos {
  const fuente = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, { min: unknown; max: unknown }>;
  const out = { ...TIEMPOS_POR_DEFECTO };
  for (const tipo of TIPOS_PEDIDO) {
    if (erroresTiempos({ ...TIEMPOS_POR_DEFECTO, [tipo]: fuente[tipo] }).length === 0) {
      out[tipo] = { min: entero(fuente[tipo].min)!, max: entero(fuente[tipo].max)! };
    }
  }
  return out;
}

/** Tiempo exacto: mínimo y máximo iguales (en el panel, modo "Exacto"). */
export const esExacto = (r: Rango): boolean => r.min === r.max;

/** "15 a 20 minutos" · "20 minutos" (si mínimo y máximo coinciden). */
export function textoRango(r: Rango): string {
  return esExacto(r) ? `${r.max} minutos` : `${r.min} a ${r.max} minutos`;
}

/**
 * El aviso del carrito en tres partes (el tiempo va resaltado):
 * "Tu domicilio llega en | 40 a 50 minutos | aprox. después de…".
 * Con un tiempo exacto no dice "aprox.".
 */
export function textoAviso(tipo: TipoPedido, r: Rango): { inicio: string; tiempo: string; fin: string } {
  return {
    inicio: tipo === 'domicilio' ? 'Tu domicilio llega en ' : 'Tu pedido estará listo en ',
    tiempo: textoRango(r),
    fin: `${esExacto(r) ? '' : ' aprox.'} después de confirmarlo por WhatsApp.`,
  };
}
