/* =============================================================
 * EXPORTAR EL MENÚ AL FORMATO DE LA PLANTILLA DE VectorPOS
 *
 * Mismas columnas que el Excel que la dueña le envía al POS:
 *   Codigo | Nombre | Precio | Categoria | Area | Descripcion
 *
 * Una fila POR PRECIO (el POS tiene un precio por producto): un plato con
 * tres opciones sale en tres filas ("Clásica - Koller", "Clásica - Pollo"…).
 * El código es el del POS cuando esa opción tiene equivalencia
 * (data/mapeo-pos.ts); las opciones que el POS no maneja por separado
 * (Pollo, Artesanal, Con Codorniz) salen sin código.
 *
 * Como usa las mismas columnas, el archivo exportado también se puede
 * volver a subir en "Precios POS".
 * ============================================================= */

import type { MapeoPos } from '@/data/mapeo-pos';
import type { Celda } from './xlsx-escribir';

/** Nombre de cada categoría en VectorPOS (tomado de su plantilla). */
const CATEGORIA_POS: Record<string, string> = {
  hamburguesas: 'HAMBURGUESAS',
  perros: 'PERROS CALIENTES',
  mazorcadas: 'MAZORCADAS',
  salchipapas: 'PAPITAS Y MAS',
  carnes: 'CARNES',
  pizzas: 'PIZZAS LASAÑAS',
  infantil: 'MENU INFANTIL',
  bebidas: 'BEBIDAS',
};
/** En el POS las cervezas tienen su propia categoría. */
const CERVEZAS = new Set(['b-poker', 'b-aguila', 'b-club-colombia', 'b-corona', 'b-coronita']);

export const COLUMNAS = ['Codigo', 'Nombre', 'Precio', 'Categoria', 'Area', 'Descripcion'];

type Opcion = { label: string; price: number };
export type FilaExportable = {
  id: string;
  cat: string;
  sort_order?: number;
  data: { name?: string; desc?: string; options?: Opcion[] };
};

/** (id del plato, opción) → código del POS. */
export function codigosPorOpcion(mapeo: Record<string, MapeoPos>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [codigo, v] of Object.entries(mapeo)) {
    if (v.tipo !== 'producto') continue;
    const clave = `${v.id}|${v.opcion}`;
    if (!m.has(clave)) m.set(clave, codigo); // Águila normal/light: se usa el primero
  }
  return m;
}

export function filasParaExportar(
  filas: FilaExportable[],
  mapeo: Record<string, MapeoPos>,
  ordenCategorias: string[],
): Celda[][] {
  const codigos = codigosPorOpcion(mapeo);
  const orden = (c: string) => {
    const i = ordenCategorias.indexOf(c);
    return i < 0 ? 999 : i;
  };
  const ordenadas = [...filas].sort((a, b) => orden(a.cat) - orden(b.cat) || (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const salida: Celda[][] = [COLUMNAS];
  for (const f of ordenadas) {
    const opciones = f.data.options ?? [];
    const nombre = (f.data.name ?? f.id).trim();
    const categoria = CERVEZAS.has(f.id) ? 'CERVEZAS' : (CATEGORIA_POS[f.cat] ?? f.cat.toUpperCase());
    for (const o of opciones) {
      salida.push([
        codigos.get(`${f.id}|${o.label}`) ?? '',
        opciones.length > 1 ? `${nombre} - ${o.label}` : nombre,
        o.price,
        categoria,
        'COCINA',
        (f.data.desc ?? '').trim(),
      ]);
    }
  }
  return salida;
}

/** "Menu_ElPorton_2026-10-24.xlsx" con la fecha de Bogotá. */
export const nombreArchivo = (ahora = new Date()) =>
  `Menu_ElPorton_${ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })}.xlsx`;
