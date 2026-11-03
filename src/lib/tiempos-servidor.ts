/* =============================================================
 * TIEMPOS DE ENTREGA (lectura en el servidor)
 *
 * La portada los lee al generarse y se los pasa al carrito. Misma
 * caché que el menú (se renueva cada 30 s): un cambio en el panel se
 * ve en la página en menos de un minuto.
 *
 * **Nunca lanza**: si la tabla `ajustes` aún no existe (falta correr
 * db/ajustes-setup.sql) o Supabase no responde, devuelve los tiempos
 * por defecto y la página sale igual.
 * ============================================================= */

import { supabaseRest } from '@/lib/supabase';
import { TIEMPOS_POR_DEFECTO, normalizarTiempos, type Tiempos } from '@/lib/tiempos';

export async function obtenerTiempos(): Promise<Tiempos> {
  try {
    const res = await supabaseRest('/rest/v1/ajustes?clave=eq.tiempos&select=valor', {
      next: { revalidate: 30 },
      timeoutMs: 2500,
    } as RequestInit & { timeoutMs: number });
    if (!res.ok) return TIEMPOS_POR_DEFECTO;
    const filas: unknown = await res.json();
    const valor = Array.isArray(filas) ? (filas[0] as { valor?: unknown } | undefined)?.valor : undefined;
    return normalizarTiempos(valor);
  } catch {
    return TIEMPOS_POR_DEFECTO;
  }
}
