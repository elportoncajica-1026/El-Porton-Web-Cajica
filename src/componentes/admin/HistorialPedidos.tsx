'use client';

/* =============================================================
 * HISTORIAL DE PEDIDOS (sección Ventas)
 *
 * Todos los pedidos con su fecha, del más nuevo al más viejo, de 25 en
 * 25 ("Ver más"), con filtro por día y búsqueda por nombre o teléfono.
 * Al tocar uno se abre su detalle completo: cliente, dirección, pago,
 * cada plato con sus variaciones y el total.
 *
 * Es de solo lectura a propósito: los estados se cambian en "Pedidos",
 * que es donde se atienden. Aquí se consulta.
 *
 * El precio de cada línea es unitPrice × qty, el mismo cálculo del
 * mensaje de WhatsApp (lib/whatsapp.ts): unitPrice ya incluye combo y
 * adiciones.
 * ============================================================= */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabaseNavegador } from '@/lib/supabase-navegador';
import {
  ETIQUETA_ESTADO,
  detallesDeLinea,
  dinero,
  enlaceWhatsApp,
  estadoDe,
  fechaCorta,
  type Pedido,
} from '@/lib/pedidos-admin';
import { rangoDia } from '@/lib/panel';
import SelectorDia from './SelectorDia';

const POR_PAGINA = 25;

/* La búsqueda va dentro de un filtro `or(...)` de PostgREST: se quitan
   comas, paréntesis y comodines para que el texto no rompa la consulta. */
const limpiarBusqueda = (q: string) => q.replace(/[^\p{L}\p{N}\s@.+-]/gu, '').trim().slice(0, 40);

const unidades = (p: Pedido) => (p.items ?? []).reduce((n, it) => n + (it.qty || 0), 0);

function fechaCompleta(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistorialPedidos({ recargarToken }: { recargarToken: number }) {
  const sb = supabaseNavegador();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dia, setDia] = useState('');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<Pedido | null>(null);

  // Espera a que dejen de escribir antes de consultar.
  useEffect(() => {
    const t = window.setTimeout(() => setBusqueda(limpiarBusqueda(texto)), 350);
    return () => window.clearTimeout(t);
  }, [texto]);

  /* "Cargando" se deduce de qué filtro está pedido y cuál ya llegó: así el
     efecto solo cambia estado después de la respuesta, nunca al empezar. */
  const clave = `${dia}|${busqueda}|${recargarToken}`;
  const [cargadoPara, setCargadoPara] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const cargando = cargadoPara !== clave;

  const pedir = useCallback(
    (desde: number) => {
      let consulta = sb.from('orders').select('*', { count: 'exact' });
      if (dia) {
        const r = rangoDia(dia);
        consulta = consulta.gte('created_at', r.desde.toISOString()).lt('created_at', r.hasta.toISOString());
      }
      if (busqueda) consulta = consulta.or(`customer_name.ilike.%${busqueda}%,customer_phone.ilike.%${busqueda}%`);
      return consulta.order('created_at', { ascending: false }).range(desde, desde + POR_PAGINA - 1);
    },
    [sb, dia, busqueda],
  );

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const { data, error: err, count } = await pedir(0);
      if (!vigente) return;
      setError(err ? 'No se pudo leer el historial: ' + err.message : null);
      setPedidos(err ? [] : (data as Pedido[]));
      setTotal(err ? null : (count ?? null));
      setCargadoPara(clave);
    })();
    return () => {
      vigente = false;
    };
  }, [pedir, clave]);

  async function verMas() {
    setCargandoMas(true);
    const { data, error: err } = await pedir(pedidos.length);
    setCargandoMas(false);
    if (err) {
      setError('No se pudieron leer más pedidos: ' + err.message);
      return;
    }
    setPedidos((prev) => [...prev, ...(data as Pedido[])]);
  }

  const hayMas = total !== null && pedidos.length < total;

  return (
    <>
      <div className="hp-filtros">
        <SelectorDia dia={dia} onCambiar={setDia} permitirTodos />
        <input
          type="search"
          className="hp-buscar"
          placeholder="Buscar por nombre o teléfono"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar pedidos por nombre o teléfono"
        />
      </div>

      {error && <p className="login-error">{error}</p>}
      {cargando ? (
        <p className="loading">Cargando historial…</p>
      ) : !pedidos.length ? (
        <p className="vt-vacio">{dia || busqueda ? 'No hay pedidos con ese filtro.' : 'Aún no hay pedidos.'}</p>
      ) : (
        <>
          {total !== null && (
            <p className="menu-count">
              {total} {total === 1 ? 'pedido' : 'pedidos'}
              {pedidos.length < total ? ` · mostrando ${pedidos.length}` : ''}
            </p>
          )}
          <ul className="hp-lista">
            {pedidos.map((p) => (
              <li key={p.id}>
                <button type="button" className="hp-fila" onClick={() => setAbierto(p)}>
                  <span className="hp-fecha">{fechaCorta(p.created_at)}</span>
                  <span className="hp-cliente">
                    <b>{p.customer_name || 'Sin nombre'}</b>
                    <small>
                      {unidades(p)} {unidades(p) === 1 ? 'producto' : 'productos'}
                    </small>
                  </span>
                  <span className={`badge-status st-${estadoDe(p.status)}`}>{ETIQUETA_ESTADO[estadoDe(p.status)]}</span>
                  <span className="hp-total">{dinero(p.subtotal)}</span>
                  <span className="hp-flecha" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
          {hayMas && (
            <button
              type="button"
              className="btn-ghost"
              style={{ margin: '1rem auto 0', display: 'block' }}
              disabled={cargandoMas}
              onClick={() => void verMas()}
            >
              {cargandoMas ? 'Cargando…' : 'Ver más pedidos'}
            </button>
          )}
        </>
      )}

      {abierto && <DetallePedido pedido={abierto} alCerrar={() => setAbierto(null)} />}
    </>
  );
}

function DetallePedido({ pedido: p, alCerrar }: { pedido: Pedido; alCerrar: () => void }) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [alCerrar]);

  const wa = enlaceWhatsApp(p.customer_phone);

  /* Va directo a <body>: la sección del panel tiene una animación de entrada
     con transform, y dentro de ella una ventana "fixed" queda descolocada. */
  return createPortal(
    <div className="mm-overlay open" onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="mm-card hp-detalle" role="dialog" aria-modal="true" aria-label={`Pedido de ${p.customer_name}`}>
        <header className="mm-head">
          <div>
            <h2>{p.customer_name || 'Pedido'}</h2>
            <p className="hp-detalle-fecha">{fechaCompleta(p.created_at)}</p>
          </div>
          <button type="button" className="mm-close" aria-label="Cerrar" onClick={alCerrar}>
            ✕
          </button>
        </header>

        <div className="mm-body">
          <div className="hp-detalle-estado">
            <span className={`badge-status st-${estadoDe(p.status)}`}>{ETIQUETA_ESTADO[estadoDe(p.status)]}</span>
            <small>Pedido #{p.id.slice(0, 8)}</small>
          </div>

          <dl className="hp-datos">
            <div>
              <dt>Teléfono</dt>
              <dd>
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener">
                    {p.customer_phone}
                  </a>
                ) : (
                  p.customer_phone || '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{p.customer_address || '—'}</dd>
            </div>
            <div>
              <dt>Pago</dt>
              <dd>
                {p.payment_method || '—'}
                {p.cash_change ? ` · paga con ${p.cash_change}` : ''}
              </dd>
            </div>
          </dl>

          <h3 className="hp-sub">Productos</h3>
          <ul className="hp-items">
            {(p.items ?? []).map((it, i) => {
              const detalle = detallesDeLinea(it);
              return (
                <li key={i}>
                  <div className="hp-item-linea">
                    <span>
                      <b>{it.qty}×</b> {it.name}
                    </span>
                    {typeof it.unitPrice === 'number' && <span>{dinero(it.unitPrice * it.qty)}</span>}
                  </div>
                  {detalle && <p className="hp-item-detalle">{detalle}</p>}
                  {it.slice && <p className="hp-item-detalle">Trozos: {it.slice}</p>}
                  {it.choices?.map((c) => (
                    <p key={c} className="hp-item-detalle">
                      {c}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>

          <div className="hp-total-final">
            <span>Total productos</span>
            <b>{dinero(p.subtotal)}</b>
          </div>
          <p className="hp-nota">El domicilio se cobra aparte y no está incluido en este total.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
