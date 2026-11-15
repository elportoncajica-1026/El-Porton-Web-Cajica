'use client';

/* =============================================================
 * VIGÍA DE PEDIDOS (hook del panel)
 *
 * Pide los últimos 10 pedidos (solo 4 columnas) y avisa de los que
 * entraron desde la última vez (lib/vigia-pedidos.ts decide cuáles son
 * nuevos). Revisa en tres momentos:
 *
 *   1. AL INSTANTE: /api/pedidos manda un "timbre" por Supabase Realtime
 *      (broadcast en el canal `pedidos`) apenas guarda un pedido. Los
 *      mensajes del websocket no los frena el navegador con la ventana
 *      minimizada, a diferencia de los relojes (setInterval), que en
 *      segundo plano pueden atrasarse hasta un minuto.
 *   2. Cada 10 s, como respaldo si el websocket se cayó.
 *   3. Al volver la pestaña a la vista o recuperar internet.
 *
 * El timbre no trae datos del pedido (solo dice "revisa"): los datos se
 * leen siempre de la base con la sesión del administrador. Broadcast no
 * exige activar nada en la base de datos.
 * ============================================================= */

import { useEffect, useRef } from 'react';
import { supabaseNavegador } from '@/lib/supabase-navegador';
import { CANAL_PEDIDOS, revisarLlegadas, VIGIA_INICIAL, type EstadoVigia } from '@/lib/vigia-pedidos';

export type PedidoLlegado = { id: string; created_at: string; customer_name: string; subtotal: number };

const CADA_MS = 10_000;

export function useVigiaPedidos(activo: boolean, alLlegar: (nuevos: PedidoLlegado[]) => void) {
  // La función cambia en cada render del panel; se guarda la última sin reiniciar el vigía.
  const avisar = useRef(alLlegar);
  useEffect(() => {
    avisar.current = alLlegar;
  });

  useEffect(() => {
    if (!activo) return;
    const sb = supabaseNavegador();
    let estado: EstadoVigia = VIGIA_INICIAL;
    let vivo = true;
    let ocupado = false;

    async function revisar() {
      if (ocupado || !vivo) return;
      ocupado = true;
      try {
        const { data, error } = await sb
          .from('orders')
          .select('id, created_at, customer_name, subtotal')
          .order('created_at', { ascending: false })
          .limit(10);
        if (!vivo || error || !data) return;
        const r = revisarLlegadas(data as PedidoLlegado[], estado);
        estado = r.estado;
        if (r.nuevos.length) avisar.current(r.nuevos);
      } finally {
        ocupado = false;
      }
    }

    void revisar(); // primera: solo marca el punto de partida
    const reloj = window.setInterval(() => void revisar(), CADA_MS);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void revisar();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);

    // El timbre puede llegar mientras otra revisión está en curso: se
    // repite al terminar para no perder el pedido recién guardado.
    let pendiente = false;
    const alTimbre = async () => {
      if (ocupado) { pendiente = true; return; }
      await revisar();
      if (pendiente) { pendiente = false; void alTimbre(); }
    };
    const timbre = sb
      .channel(CANAL_PEDIDOS)
      .on('broadcast', { event: 'nuevo' }, () => void alTimbre())
      .subscribe();

    return () => {
      vivo = false;
      void sb.removeChannel(timbre);
      window.clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
    };
  }, [activo]);
}
