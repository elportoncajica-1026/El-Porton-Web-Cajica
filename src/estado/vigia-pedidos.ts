'use client';

/* =============================================================
 * VIGÍA DE PEDIDOS (hook del panel)
 *
 * Cada 10 s, y en cuanto la pestaña vuelve a estar a la vista, pide
 * los últimos 10 pedidos (solo 4 columnas) y avisa de los que entraron
 * desde la última vez (lib/vigia-pedidos.ts decide cuáles son nuevos).
 *
 * Por qué consultar y no Supabase Realtime: Realtime exige activar la
 * tabla en la publicación de la base (un paso manual en Supabase) y
 * mantener un websocket que se cae con el celular en reposo. Una
 * consulta mínima cada 10 s funciona ya, sin tocar la base, y se
 * recupera sola. El costo es despreciable: una fila pequeña × 10.
 * ============================================================= */

import { useEffect, useRef } from 'react';
import { supabaseNavegador } from '@/lib/supabase-navegador';
import { revisarLlegadas, VIGIA_INICIAL, type EstadoVigia } from '@/lib/vigia-pedidos';

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

    return () => {
      vivo = false;
      window.clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
    };
  }, [activo]);
}
