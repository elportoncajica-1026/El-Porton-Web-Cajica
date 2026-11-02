'use client';

/* =============================================================
 * PESTAÑA DE PEDIDOS
 *
 * ⚠️ CAMBIO RESPECTO A v1: se piden POR PÁGINAS.
 *
 * v1 hace `select('*')` sin límite. La API de Supabase corta en 1000
 * filas, así que el panel descarga hasta 1000 pedidos completos —con
 * su JSON de productos— cada vez que se abre. Con ~20 pedidos al día
 * eso son varios megabytes a los dos meses, y desde el celular del
 * dueño se nota.
 *
 * Aquí se traen de 50 en 50 con "Ver más". Además se pide el total
 * exacto con `count`, que Postgres calcula sin devolver las filas.
 * ============================================================= */

import { useCallback, useEffect, useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase-navegador';
import BotonesEstado from './BotonesEstado';
import {
  ESTADOS,
  ETIQUETA_ESTADO,
  VALORES_EN_BD,
  detallesDeLinea,
  estadoDe,
  dinero,
  enlaceWhatsApp,
  fechaCorta,
  type EstadoPedido,
  type Pedido,
} from '@/lib/pedidos-admin';
import { fechaLarga, rangoDia } from '@/lib/panel';
import SelectorDia from './SelectorDia';

const POR_PAGINA = 50;

type Filtro = 'todos' | EstadoPedido;

export default function Pedidos({
  recargarToken,
  alCambiar,
}: {
  recargarToken: number;
  /** Avisa al panel para que actualice el contador de pedidos nuevos. */
  alCambiar?: () => void;
}) {
  const sb = supabaseNavegador();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  /* Calendario: "" = todos los días; "AAAA-MM-DD" = solo ese día (Bogotá). */
  const [dia, setDia] = useState('');

  const cargar = useCallback(
    async (desde: number) => {
      setError(null);
      if (desde === 0) setCargando(true);

      let consulta = sb.from('orders').select('*', { count: 'exact' });
      if (filtro !== 'todos') consulta = consulta.in('status', VALORES_EN_BD[filtro]);
      if (dia) {
        const r = rangoDia(dia);
        consulta = consulta.gte('created_at', r.desde.toISOString()).lt('created_at', r.hasta.toISOString());
      }
      const { data, error: err, count } = await consulta
        .order('created_at', { ascending: false })
        .range(desde, desde + POR_PAGINA - 1);

      setCargando(false);
      if (err) {
        setError('No se pudieron leer los pedidos: ' + err.message);
        return;
      }
      setTotal(count ?? null);
      // Pedidos viejos con "preparando"/"en camino" se muestran como En sistema.
      const filas = (data as Pedido[]).map((p) => ({ ...p, status: estadoDe(p.status) }));
      setPedidos((prev) => (desde === 0 ? filas : [...prev, ...filas]));
    },
    [sb, filtro, dia],
  );

  useEffect(() => {
    void cargar(0);
  }, [cargar, recargarToken]);

  /** Cambia el estado. Se pinta primero y se revierte si falla. */
  async function cambiarEstado(id: string, nuevo: EstadoPedido) {
    const anterior = pedidos.find((p) => p.id === id)?.status;
    setGuardando(id);
    setPedidos((ps) => ps.map((p) => (p.id === id ? { ...p, status: nuevo } : p)));

    const { error: err } = await sb.from('orders').update({ status: nuevo }).eq('id', id);
    setGuardando(null);

    if (err) {
      // v1 deja el desplegable en el valor nuevo aunque falle, así que
      // el panel muestra un estado que la base no tiene.
      if (anterior) setPedidos((ps) => ps.map((p) => (p.id === id ? { ...p, status: anterior } : p)));
      setError('No se pudo actualizar el estado: ' + err.message);
      return;
    }
    alCambiar?.();
  }

  const hayMas = total !== null && pedidos.length < total;

  const chips = (
    <>
    <SelectorDia dia={dia} onCambiar={setDia} permitirTodos />
    <div className="pn-chips" role="tablist" aria-label="Filtrar pedidos por estado">
      {(['todos', ...ESTADOS] as Filtro[]).map((f) => (
        <button
          key={f}
          type="button"
          role="tab"
          aria-selected={filtro === f}
          className={`pn-chip${filtro === f ? ' is-activo' : ''}`}
          onClick={() => setFiltro(f)}
        >
          {f === 'todos' ? 'Todos' : ETIQUETA_ESTADO[f]}
        </button>
      ))}
    </div>
    </>
  );

  if (cargando) return <>{chips}<p className="loading">Cargando pedidos…</p></>;
  if (error && !pedidos.length) return <>{chips}<p className="empty-state">{error}</p></>;
  if (!pedidos.length)
    return (
      <>
        {chips}
        <p className="empty-state">
          {dia
            ? `No hay pedidos${filtro === 'todos' ? '' : ` en "${ETIQUETA_ESTADO[filtro]}"`} el ${fechaLarga(dia).toLowerCase()}.`
            : filtro === 'todos'
              ? 'Aún no hay pedidos.'
              : `No hay pedidos en "${ETIQUETA_ESTADO[filtro]}".`}
        </p>
      </>
    );

  return (
    <>
      {chips}
      {error && <p className="login-error">{error}</p>}

      {total !== null && (
        <p className="menu-count">
          Mostrando {pedidos.length} de {total} pedidos
        </p>
      )}

      <div id="orders-list">
        {pedidos.map((o) => (
          <article className="order-card" key={o.id}>
            <div className="order-head">
              <div>
                <div className="order-name">
                  {o.customer_name}{' '}
                  <span className={`badge-status st-${o.status}`}>
                    {ETIQUETA_ESTADO[o.status] ?? o.status}
                  </span>
                </div>
                <div className="order-when">{fechaCorta(o.created_at)}</div>
              </div>
              <div className="order-total">{dinero(o.subtotal)}</div>
            </div>

            <div className="order-meta">
              <span>
                📞{' '}
                {enlaceWhatsApp(o.customer_phone) ? (
                  <a href={enlaceWhatsApp(o.customer_phone)} target="_blank" rel="noopener">
                    {o.customer_phone}
                  </a>
                ) : (
                  o.customer_phone || '—'
                )}
              </span>
              <span>📍 {o.customer_address}</span>
              <span>
                💳 {o.payment_method || '—'}
                {o.cash_change ? ` (${o.cash_change})` : ''}
              </span>
            </div>

            <ul className="order-items">
              {(o.items ?? []).map((it, i) => {
                const detalle = detallesDeLinea(it);
                return (
                  <li key={i}>
                    • ({it.qty}x) {it.name}
                    {detalle && <span style={{ color: '#71717a' }}> — {detalle}</span>}
                  </li>
                );
              })}
            </ul>

            <div className="order-foot">
              <BotonesEstado
                actual={o.status}
                deshabilitado={guardando === o.id}
                onCambiar={(nuevo) => void cambiarEstado(o.id, nuevo)}
              />
            </div>
          </article>
        ))}
      </div>

      {hayMas && (
        <button
          type="button"
          className="btn-ghost"
          style={{ margin: '1.2rem auto', display: 'block' }}
          onClick={() => void cargar(pedidos.length)}
        >
          Ver más pedidos
        </button>
      )}
    </>
  );
}
