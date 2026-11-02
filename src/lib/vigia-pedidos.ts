/* =============================================================
 * VIGÍA DE PEDIDOS NUEVOS (lógica pura)
 *
 * El panel consulta cada pocos segundos los últimos pedidos y esta
 * función decide cuáles son de verdad nuevos. La primera consulta solo
 * marca el punto de partida: lo que ya estaba al abrir el panel no
 * suena (si no, cada recarga dispararía la campana por pedidos viejos).
 *
 * Se recuerdan los ids ya vistos y no solo la hora, porque dos pedidos
 * pueden llegar en el mismo milisegundo y porque la hora del celular
 * del cliente no interviene: `created_at` lo pone la base.
 * ============================================================= */

export type Huella = { id: string; created_at: string };

export type EstadoVigia = {
  /** Hora del pedido más nuevo visto; null = aún no hay punto de partida. */
  marca: string | null;
  /** Ids ya vistos con hora >= marca (para no repetir avisos). */
  vistos: string[];
};

export const VIGIA_INICIAL: EstadoVigia = { marca: null, vistos: [] };

/**
 * Recibe los pedidos más recientes (en cualquier orden) y el estado
 * anterior; devuelve los que llegaron desde la última vez (del más
 * viejo al más nuevo, para avisar en orden) y el estado nuevo.
 */
export function revisarLlegadas<T extends Huella>(
  recientes: T[],
  previo: EstadoVigia,
): { nuevos: T[]; estado: EstadoVigia } {
  const ordenados = [...recientes].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const masNuevo = ordenados[ordenados.length - 1];

  // Primera vez: solo se fija el punto de partida.
  if (previo.marca === null) {
    if (!masNuevo) return { nuevos: [], estado: { marca: '', vistos: [] } };
    return { nuevos: [], estado: estadoDesde(ordenados, masNuevo.created_at) };
  }

  const vistos = new Set(previo.vistos);
  const nuevos = ordenados.filter((p) => p.created_at >= previo.marca! && !vistos.has(p.id));
  if (!nuevos.length) return { nuevos: [], estado: previo };

  const marca = masNuevo.created_at > previo.marca ? masNuevo.created_at : previo.marca;
  return { nuevos, estado: estadoDesde(ordenados, marca) };
}

function estadoDesde(ordenados: Huella[], marca: string): EstadoVigia {
  return { marca, vistos: ordenados.filter((p) => p.created_at >= marca).map((p) => p.id) };
}

/** Título de la pestaña con el número de pedidos sin atender. */
export function tituloConAviso(base: string, sinAtender: number): string {
  return sinAtender > 0 ? `(${sinAtender}) Nuevo pedido · ${base}` : base;
}
