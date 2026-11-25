'use client';

/* =============================================================
 * CRECIMIENTO — qué funciona, cómo funciona y qué no
 *
 * De dónde llega la gente, dónde se cae, qué anuncio trae pedidos y
 * quién vuelve. Los cálculos están en lib/crecimiento.ts (probados);
 * aquí solo se piden los datos y se pintan.
 *
 * Cada bloque se anima cuando entra en pantalla al hacer scroll
 * (IntersectionObserver): barras que crecen, líneas que se dibujan,
 * números que cuentan y celdas que se encienden.
 *
 * Datos: TODOS los pedidos (hacen falta para saber quién es nuevo y
 * quién vuelve) y los eventos de los dos últimos periodos. Se piden por
 * páginas de 1000 porque la API corta ahí sin avisar.
 * ============================================================= */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabaseNavegador } from '@/lib/supabase-navegador';
import { dinero, detallesDeLinea, enlaceWhatsApp, fechaCorta, ETIQUETA_ESTADO, estadoDe } from '@/lib/pedidos-admin';
import { nombreFuente, textoConocio } from '@/lib/rastreo';
import { MENU } from '@/data/menu';
import {
  DIAS_SEMANA,
  HORAS,
  PASOS_EMBUDO,
  SIN_DATO,
  calorHorario,
  cambio,
  clientes as agruparClientes,
  conocio as contarConocio,
  dormidos as filtrarDormidos,
  embudo as calcularEmbudo,
  etiquetaPedido,
  etiquetaToque,
  mayorFuga,
  normTel,
  periodos,
  platoFavorito,
  platos as calcularPlatos,
  porOrigen,
  resumen as calcularResumen,
  semanas as calcularSemanas,
  seriePorDia,
  telOculto,
  type Cliente,
  type EventoCr,
  type PedidoCr,
} from '@/lib/crecimiento';
import { Contador, Esqueleto } from './Animaciones';

const COLUMNAS = 'id,created_at,customer_name,customer_phone,customer_address,payment_method,cash_change,subtotal,items,status';
const PAGINA = 1000;
const MAX_PAGINAS = 30;
/* Colores de las series (validados para daltonismo sobre el fondo del panel). */
const SERIES = ['#3987e5', '#199e70', '#c98500', '#9085e9'];
const PERIODOS = [
  { dias: 7, texto: 'Últimos 7 días' },
  { dias: 30, texto: 'Últimos 30 días' },
  { dias: 90, texto: 'Últimos 90 días' },
];
const NOMBRES_PLATO = new Map(MENU.map((p) => [p.id, p.name]));
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`);

type Fila = Record<string, unknown>;
type Resp = { data: Fila[] | null; error: { message: string } | null };

/** Pide todas las páginas de una consulta (hasta MAX_PAGINAS). */
async function porPaginas(consulta: (a: number, b: number) => PromiseLike<Resp>): Promise<{ filas: Fila[]; error: string | null }> {
  const filas: Fila[] = [];
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const { data, error } = await consulta(i * PAGINA, (i + 1) * PAGINA - 1);
    if (error) return { filas, error: error.message };
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return { filas, error: null };
}

/* ---------- animación al entrar en pantalla ---------- */
function useVisible<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    // Sin IntersectionObserver (navegador muy viejo) se muestra todo de una.
    if (typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  return [ref, visible];
}

function Bloque({
  titulo,
  sub,
  fuente,
  className = '',
  children,
}: {
  titulo: string;
  sub?: string;
  fuente?: { texto: string; tipo: 'ya' | 'nuevo' | 'meta' };
  className?: string;
  children: (visible: boolean) => ReactNode;
}) {
  const [ref, visible] = useVisible<HTMLElement>();
  return (
    <section ref={ref} className={`pn-tarjeta cr-bloque ${className}${visible ? ' is-visible' : ''}`}>
      <div className="cr-cab">
        <h3>{titulo}</h3>
        {fuente && <span className={`cr-fuente cr-fuente--${fuente.tipo}`}>{fuente.texto}</span>}
      </div>
      {sub && <p className="cr-sub">{sub}</p>}
      {children(visible)}
    </section>
  );
}

export default function Crecimiento({ recargarToken }: { recargarToken: number }) {
  const sb = supabaseNavegador();
  const [dias, setDias] = useState(30);
  const [pedidos, setPedidos] = useState<PedidoCr[] | null>(null);
  const [eventos, setEventos] = useState<EventoCr[]>([]);
  const [sinOrigen, setSinOrigen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    setError(null);
    const t = Date.now();
    const desdeEventos = new Date(periodos(dias, t).anterior.desde).toISOString();

    const pedir = (cols: string) =>
      porPaginas((a, b) => sb.from('orders').select(cols).order('created_at', { ascending: false }).range(a, b) as unknown as PromiseLike<Resp>);
    let rp = await pedir(`${COLUMNAS},origen`);
    let faltaColumna = false;
    if (rp.error && /origen/.test(rp.error)) {
      faltaColumna = true;
      rp = await pedir(COLUMNAS);
    }
    const re = await porPaginas(
      (a, b) =>
        sb.from('events').select('type,created_at,meta').gte('created_at', desdeEventos).order('created_at').range(a, b) as unknown as PromiseLike<Resp>,
    );

    if (rp.error) setError('No se pudieron leer los pedidos: ' + rp.error);
    setSinOrigen(faltaColumna);
    setPedidos(rp.filas as unknown as PedidoCr[]);
    setEventos(re.error ? [] : (re.filas as unknown as EventoCr[]));
    setAhora(t);
  }, [sb, dias]);

  useEffect(() => {
    void cargar();
  }, [cargar, recargarToken]);

  if (!pedidos) {
    return (
      <div className="pn-tarjeta">
        <Esqueleto lineas={6} />
      </div>
    );
  }
  return (
    <>
      {error && <p className="login-error">{error}</p>}
      <CrecimientoVista pedidos={pedidos} eventos={eventos} ahora={ahora} dias={dias} onDias={setDias} sinOrigen={sinOrigen} />
    </>
  );
}

/** La vista, solo con datos: se puede probar sin base de datos. */
export function CrecimientoVista({
  pedidos,
  eventos,
  ahora,
  dias,
  onDias,
  sinOrigen,
}: {
  pedidos: PedidoCr[];
  eventos: EventoCr[];
  ahora: number;
  dias: number;
  onDias: (d: number) => void;
  sinOrigen: boolean;
}) {
  const [filtro, setFiltro] = useState<string>('');
  const datos = useMemo(() => {
    const { actual, anterior } = periodos(dias, ahora);
    const filasOrigen = porOrigen(pedidos, eventos, actual);
    const top = filasOrigen.filter((f) => f.pedidos > 0).slice(0, SERIES.length).map((f) => f.etiqueta);
    const lista = agruparClientes(pedidos);
    return {
      actual,
      res: calcularResumen(pedidos, eventos, actual),
      prev: calcularResumen(pedidos, eventos, anterior),
      filasOrigen,
      top,
      serie: seriePorDia(pedidos, actual, top),
      lista,
      dormidos: filtrarDormidos(lista, ahora).slice(0, 8),
      semanas: calcularSemanas(pedidos, ahora),
      platos: calcularPlatos(pedidos, eventos, actual, NOMBRES_PLATO).slice(0, 8),
      conocio: contarConocio(pedidos, actual),
      calor: calorHorario(pedidos, actual),
      hayEventosNuevos: eventos.some((e) => e.type === 'page_view'),
    };
  }, [pedidos, eventos, dias, ahora]);

  const etiquetas = datos.filasOrigen.map((f) => f.etiqueta);

  return (
    <div className="cr">
      <div className="cr-filtros">
        <select aria-label="Periodo" value={dias} onChange={(e) => onDias(Number(e.target.value))}>
          {PERIODOS.map((p) => (
            <option key={p.dias} value={p.dias}>
              {p.texto}
            </option>
          ))}
        </select>
        <select aria-label="Origen o anuncio" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos los orígenes</option>
          {etiquetas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {sinOrigen && (
        <p className="cr-aviso">
          Falta correr <code>db/crecimiento-setup.sql</code> en Supabase: hasta entonces los pedidos se guardan sin su
          origen.
        </p>
      )}
      {!datos.hayEventosNuevos && (
        <p className="cr-aviso">
          La medición por anuncio empieza con esta versión de la web: las visitas, el embudo y el comparador se llenan
          desde ahora. Los pedidos anteriores aparecen como &quot;{SIN_DATO}&quot;.
        </p>
      )}

      <Kpis res={datos.res} prev={datos.prev} />

      <div className="cr-dos">
        <Embudo eventos={eventos} rango={datos.actual} filtro={filtro || null} />
        <Lineas dias={datos.serie.dias} series={datos.serie.series} etiquetas={datos.top} />
      </div>

      <Comparador filas={datos.filasOrigen} filtro={filtro} />

      <ListaClientes lista={datos.lista} />

      <div className="cr-dos">
        <Semanas nuevos={datos.semanas.nuevos} recurrentes={datos.semanas.recurrentes} />
        <Dormidos lista={datos.dormidos} />
      </div>

      <div className="cr-dos">
        <Platos filas={datos.platos} />
        <Conocio filas={datos.conocio} />
      </div>

      <Calor matriz={datos.calor} />

      <Bloque titulo="Redes" fuente={{ texto: 'Fase posterior', tipo: 'meta' }} sub="Primero Meta Ads (gasto e impresiones, para el costo por pedido), luego Instagram. TikTok entrega menos datos.">
        {() => null}
      </Bloque>
    </div>
  );
}

/* ---------- resumen ---------- */
function Kpis({ res, prev }: { res: ReturnType<typeof calcularResumen>; prev: ReturnType<typeof calcularResumen> }) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  const items: { t: string; v: number; f: (n: number) => string; antes: number }[] = [
    { t: 'Personas', v: res.personas, antes: prev.personas, f: (n) => String(Math.round(n)) },
    { t: 'Pedidos', v: res.pedidos, antes: prev.pedidos, f: (n) => String(Math.round(n)) },
    { t: 'Conversión', v: (res.conversion ?? 0) * 100, antes: (prev.conversion ?? 0) * 100, f: (n) => (res.conversion === null ? '—' : `${n.toFixed(1).replace('.', ',')}%`) },
    { t: 'Ticket promedio', v: res.ticket, antes: prev.ticket, f: (n) => dinero(Math.round(n)) },
    { t: 'Clientes nuevos', v: res.nuevos, antes: prev.nuevos, f: (n) => String(Math.round(n)) },
    { t: 'Recurrentes', v: res.recurrentes, antes: prev.recurrentes, f: (n) => String(Math.round(n)) },
  ];
  return (
    <div ref={ref} className={`cr-kpis${visible ? ' is-visible' : ''}`}>
      {items.map((k, i) => {
        const c = cambio(k.v, k.antes);
        return (
          <div className="pn-tarjeta cr-kpi" key={k.t} style={{ '--i': i } as React.CSSProperties}>
            <span>{k.t}</span>
            <b>
              <Contador valor={visible ? k.v : 0} formato={k.f} />
            </b>
            <small className={c === null ? '' : c < 0 ? 'is-baja' : 'is-sube'}>
              {c === null ? 'sin periodo anterior' : `${c < 0 ? '↓' : '↑'} ${Math.abs(c)}% vs. antes`}
            </small>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- embudo ---------- */
function Embudo({ eventos, rango, filtro }: { eventos: EventoCr[]; rango: { desde: number; hasta: number }; filtro: string | null }) {
  const valores = calcularEmbudo(eventos, rango, filtro);
  const fuga = mayorFuga(valores);
  const max = Math.max(1, valores[0], ...valores);
  return (
    <Bloque titulo="Embudo" fuente={{ texto: 'Desde ahora', tipo: 'nuevo' }} sub={filtro ? `Solo: ${filtro}` : 'Dónde se cae la gente. Filtra por origen arriba.'}>
      {() => (
        <div className="cr-embudo">
          {PASOS_EMBUDO.map((p, i) => (
            <div key={p.tipo}>
              {i > 0 && (
                <p className={`cr-paso${i === fuga ? ' is-fuga' : ''}`}>
                  {i === fuga ? '▼ mayor fuga: ' : '↳ '}
                  {valores[i - 1] ? `pasa el ${Math.round((valores[i] / valores[i - 1]) * 100)}%` : 'sin datos'}
                </p>
              )}
              <div className="cr-fila" title={`${p.texto}: ${valores[i]}`}>
                <span>{p.texto}</span>
                <div className="cr-pista">
                  <i className="cr-barra" style={{ width: `${(valores[i] / max) * 100}%`, '--i': i } as React.CSSProperties} />
                </div>
                <em>{valores[i]}</em>
              </div>
            </div>
          ))}
        </div>
      )}
    </Bloque>
  );
}

/* ---------- pedidos por día y origen ---------- */
function Lineas({ dias, series, etiquetas }: { dias: string[]; series: number[][]; etiquetas: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 220;
  const L = 28;
  const R = 10;
  const T = 10;
  const B = 22;
  const max = 2 * Math.ceil(Math.max(2, ...series.flat()) / 2);
  const n = Math.max(1, dias.length - 1);
  const x = (i: number) => L + (i * (W - L - R)) / n;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const marcas = [0, Math.round(n / 2), n];
  const etiquetaDia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return (
    <Bloque titulo="Pedidos por día y origen" fuente={{ texto: 'Desde ahora', tipo: 'nuevo' }} sub="¿El que va ganando se mantiene?">
      {() =>
        etiquetas.length === 0 ? (
          <p className="cr-vacio">Todavía no hay pedidos con origen en este periodo.</p>
        ) : (
          <>
            {etiquetas.length > 1 && (
              <div className="cr-leyenda">
                {etiquetas.map((t, k) => (
                  <span key={t}>
                    <i style={{ background: SERIES[k] }} />
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="cr-svg">
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pedidos por día y origen" onPointerLeave={() => setHover(null)}>
                {[0, max / 2, max].map((v) => (
                  <g key={v}>
                    <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="cr-grid" />
                    <text x={L - 6} y={y(v) + 4} textAnchor="end">
                      {v}
                    </text>
                  </g>
                ))}
                {marcas.map((i) => (
                  <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === n ? 'end' : 'middle'}>
                    {dias[i] ? etiquetaDia(dias[i]) : ''}
                  </text>
                ))}
                {series.map((s, k) => (
                  <polyline
                    key={etiquetas[k]}
                    className="cr-linea"
                    pathLength={1}
                    stroke={SERIES[k]}
                    style={{ '--i': k } as React.CSSProperties}
                    points={s.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                  />
                ))}
                {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cr-cursor" />}
                {dias.map((d, i) => (
                  <rect key={d} x={x(i) - (W - L - R) / n / 2} y={0} width={(W - L - R) / n} height={H} fill="transparent" onPointerEnter={() => setHover(i)} />
                ))}
              </svg>
              {hover !== null && (
                <div className="cr-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
                  <b>{etiquetaDia(dias[hover])}</b>
                  {etiquetas.map((t, k) => (
                    <span key={t}>
                      <i style={{ background: SERIES[k] }} />
                      {t}: {series[k][hover]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )
      }
    </Bloque>
  );
}

/* ---------- comparador ---------- */
function Comparador({ filas, filtro }: { filas: ReturnType<typeof porOrigen>; filtro: string }) {
  return (
    <Bloque
      titulo="Comparador de orígenes y anuncios"
      fuente={{ texto: 'Desde ahora', tipo: 'nuevo' }}
      sub="Cuando se conecte Meta aparecerán el gasto y el costo por pedido, que es lo que decide el ganador."
    >
      {() =>
        filas.length === 0 ? (
          <p className="cr-vacio">Sin datos en este periodo.</p>
        ) : (
          <div className="pn-tabla-wrap">
            <table className="pn-tabla cr-tabla">
              <thead>
                <tr>
                  <th>Origen o anuncio</th>
                  <th>Personas</th>
                  <th>Carritos</th>
                  <th>Pedidos</th>
                  <th>Ventas</th>
                  <th>Conversión</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.etiqueta} className={filtro && filtro !== f.etiqueta ? 'is-apagada' : ''} style={{ '--i': i } as React.CSSProperties}>
                    <td>{f.etiqueta}</td>
                    <td>{f.personas}</td>
                    <td>{f.carritos}</td>
                    <td>{f.pedidos}</td>
                    <td>{dinero(f.ventas)}</td>
                    <td>{pct(f.conversion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </Bloque>
  );
}

/* ---------- quién pidió y de dónde llegó ---------- */
function ListaClientes({ lista }: { lista: Cliente[] }) {
  const [buscar, setBuscar] = useState('');
  const [abierto, setAbierto] = useState<Cliente | null>(null);
  const [cuantos, setCuantos] = useState(15);
  const q = buscar.toLowerCase().trim();
  const qTel = normTel(buscar);
  const filtrados = q ? lista.filter((c) => c.nombre.toLowerCase().includes(q) || (qTel.length >= 3 && c.tel.includes(qTel))) : lista;
  return (
    <Bloque
      titulo="Quién pidió y de dónde llegó"
      fuente={{ texto: 'Datos del pedido: ya · Origen: desde ahora', tipo: 'ya' }}
      sub='Toca un nombre para ver su ficha. Los pedidos anteriores a esta versión salen como "Sin dato".'
    >
      {() => (
        <>
          <input className="cr-buscar" type="search" placeholder="Buscar por nombre o teléfono" aria-label="Buscar cliente" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <div className="pn-tabla-wrap">
            <table className="pn-tabla cr-tabla cr-clientes">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Llegó por</th>
                  <th>Pedidos</th>
                  <th>Total</th>
                  <th>Último</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, cuantos).map((c, i) => (
                  <tr key={c.tel} style={{ '--i': Math.min(i, 10) } as React.CSSProperties}>
                    <td>
                      <button type="button" className="cr-nombre" onClick={() => setAbierto(c)}>
                        {c.nombre}
                      </button>
                    </td>
                    <td>{etiquetaToque(c.primero)}</td>
                    <td>{c.pedidos.length}</td>
                    <td>{dinero(c.total)}</td>
                    <td>{fechaCorta(c.pedidos[0].created_at)}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={5}>Nadie coincide con la búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtrados.length > cuantos && (
            <button type="button" className="pn-enlace cr-mas" onClick={() => setCuantos((n) => n + 30)}>
              Ver más ({filtrados.length - cuantos})
            </button>
          )}
          {abierto && <Ficha cliente={abierto} alCerrar={() => setAbierto(null)} />}
        </>
      )}
    </Bloque>
  );
}

function Ficha({ cliente: c, alCerrar }: { cliente: Cliente; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const ultimo = c.pedidos[0];
  const filas: [string, ReactNode][] = [
    ['Teléfono', <a key="t" href={enlaceWhatsApp(ultimo.customer_phone)} target="_blank" rel="noopener">{ultimo.customer_phone}</a>],
    ['Dirección', ultimo.customer_address],
    ['Forma de pago', ultimo.payment_method ?? '—'],
    ['Paga con', ultimo.cash_change || '—'],
    ['Llegó la primera vez por', c.primero ? nombreFuente(c.primero.fuente) : SIN_DATO],
    ['Primer anuncio', c.primero?.anuncio ?? '—'],
    ['¿Cómo nos conoció?', textoConocio(c.pedidos.find((p) => p.origen?.conocio)?.origen?.conocio)],
    ['Acepta promociones', c.promos ? 'Sí' : 'No'],
    ['Pedidos', `${c.pedidos.length} · ${dinero(c.total)}`],
  ];
  return (
    <dialog ref={ref} className="cr-ficha" aria-labelledby="cr-ficha-nombre" onClose={alCerrar} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <button type="button" className="cr-cerrar" onClick={() => ref.current?.close()}>
        Cerrar
      </button>
      <h3 id="cr-ficha-nombre">{c.nombre}</h3>
      <dl>
        {filas.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <h4>Sus pedidos</h4>
      {c.pedidos.map((p) => (
        <div className="cr-pedido" key={p.id}>
          <p>
            <b>{dinero(p.subtotal)}</b> · {ETIQUETA_ESTADO[estadoDe(p.status)]}
          </p>
          <small>
            {fechaCorta(p.created_at)} · llegó por: {etiquetaPedido(p)}
          </small>
          <ul>
            {(p.items ?? []).map((it, i) => {
              const det = detallesDeLinea(it);
              return (
                <li key={i}>
                  {it.qty} {it.name}
                  {det && <span> · {det}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </dialog>
  );
}

/* ---------- clientes por semana ---------- */
function Semanas({ nuevos, recurrentes }: { nuevos: number[]; recurrentes: number[] }) {
  const max = Math.max(1, ...nuevos.map((v, i) => v + recurrentes[i]));
  const W = 420;
  const H = 190;
  const base = 165;
  const alto = 145;
  const paso = (W - 20) / nuevos.length;
  return (
    <Bloque titulo="Clientes por semana" fuente={{ texto: 'Con tu historial', tipo: 'ya' }} sub="Nuevos y recurrentes, según el teléfono del pedido">
      {() => (
        <>
          <div className="cr-leyenda">
            <span>
              <i style={{ background: SERIES[0] }} />
              Nuevos
            </span>
            <span>
              <i style={{ background: SERIES[1] }} />
              Recurrentes
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Clientes nuevos y recurrentes por semana" className="cr-svg-bloque">
            {nuevos.map((v, i) => {
              const h1 = (v / max) * alto;
              const h2 = (recurrentes[i] / max) * alto;
              const bx = 10 + i * paso + paso / 2 - 12;
              return (
                <g key={i} className="cr-columna" style={{ '--i': i } as React.CSSProperties}>
                  <title>{`Semana ${i + 1}: ${v} nuevos, ${recurrentes[i]} recurrentes`}</title>
                  {h1 > 0 && <rect x={bx} y={base - h1} width={24} height={h1} fill={SERIES[0]} />}
                  {h2 > 0 && <rect x={bx} y={base - h1 - h2 - (h1 > 0 ? 2 : 0)} width={24} height={h2} rx={4} fill={SERIES[1]} />}
                  <text x={bx + 12} y={base + 18} textAnchor="middle">
                    {i === nuevos.length - 1 ? 'Esta' : `-${nuevos.length - 1 - i}`}
                  </text>
                </g>
              );
            })}
            <line x1={6} x2={W - 6} y1={base} y2={base} className="cr-eje" />
          </svg>
        </>
      )}
    </Bloque>
  );
}

/* ---------- dormidos ---------- */
function Dormidos({ lista }: { lista: Cliente[] }) {
  return (
    <Bloque titulo="Clientes dormidos" fuente={{ texto: 'Con tu historial', tipo: 'ya' }} sub="Pidieron antes y llevan más de 30 días sin volver">
      {() =>
        lista.length === 0 ? (
          <p className="cr-vacio">Nadie lleva más de 30 días sin volver.</p>
        ) : (
          <>
            <div className="pn-tabla-wrap">
              <table className="pn-tabla cr-tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Pedidos</th>
                    <th>Último</th>
                    <th>Suele pedir</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c, i) => (
                    <tr key={c.tel} style={{ '--i': i } as React.CSSProperties}>
                      <td>
                        {c.nombre}
                        <small className="cr-tel">{telOculto(c.tel)}</small>
                      </td>
                      <td>{c.pedidos.length}</td>
                      <td>{fechaCorta(c.pedidos[0].created_at)}</td>
                      <td>{platoFavorito(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cr-nota">Solo se les pueden enviar promociones a quienes marcaron la casilla de promociones en el carrito.</p>
          </>
        )
      }
    </Bloque>
  );
}

/* ---------- platos ---------- */
function Platos({ filas }: { filas: ReturnType<typeof calcularPlatos> }) {
  return (
    <Bloque titulo="Platos" fuente={{ texto: 'Pedidos: ya · Vistas: desde ahora', tipo: 'ya' }} sub="Los que se miran mucho y casi no se piden">
      {() =>
        filas.length === 0 ? (
          <p className="cr-vacio">Sin datos en este periodo.</p>
        ) : (
          <div className="pn-tabla-wrap">
            <table className="pn-tabla cr-tabla">
              <thead>
                <tr>
                  <th>Plato</th>
                  <th>Vistas</th>
                  <th>Pedidos</th>
                  <th>De cada 100 vistas</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const r = f.vistas ? (f.pedidos / f.vistas) * 100 : null;
                  return (
                    <tr key={f.id} style={{ '--i': i } as React.CSSProperties}>
                      <td>{f.nombre}</td>
                      <td>{f.vistas}</td>
                      <td>{f.pedidos}</td>
                      <td>
                        {r === null ? '—' : Math.round(r)}
                        {r !== null && f.vistas >= 20 && r < 8 && <span className="cr-revisar">⚠ revisar</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      }
    </Bloque>
  );
}

/* ---------- ¿cómo nos conociste? ---------- */
function Conocio({ filas }: { filas: { valor: string; n: number }[] }) {
  const total = filas.reduce((s, f) => s + f.n, 0);
  const max = Math.max(1, ...filas.map((f) => f.n));
  return (
    <Bloque titulo="¿Cómo nos conociste?" fuente={{ texto: 'Pregunta nueva en el carrito', tipo: 'nuevo' }} sub="Cubre lo que la medición automática no ve">
      {() =>
        total === 0 ? (
          <p className="cr-vacio">Todavía no hay respuestas.</p>
        ) : (
          <div className="cr-embudo">
            {filas.map((f, i) => (
              <div className="cr-fila" key={f.valor} title={`${textoConocio(f.valor)}: ${f.n}`}>
                <span>{textoConocio(f.valor)}</span>
                <div className="cr-pista">
                  <i className="cr-barra" style={{ width: `${(f.n / max) * 100}%`, '--i': i } as React.CSSProperties} />
                </div>
                <em>{Math.round((f.n / total) * 100)}%</em>
              </div>
            ))}
          </div>
        )
      }
    </Bloque>
  );
}

/* ---------- horarios ---------- */
function Calor({ matriz }: { matriz: number[][] }) {
  const max = Math.max(1, ...matriz.flat());
  const etiquetaHora = (h: number) => (h > 12 ? `${h - 12} pm` : `${h} m`);
  return (
    <Bloque titulo="Horarios" fuente={{ texto: 'Con tu historial', tipo: 'ya' }} sub="Pedidos por día y hora: más intenso, más pedidos. Sirve para programar los anuncios.">
      {() => (
        <div className="cr-calor" role="table" aria-label="Pedidos por día y hora">
          <span />
          {HORAS.map((h) => (
            <span key={h} className="cr-calor-h">
              {etiquetaHora(h)}
            </span>
          ))}
          {DIAS_SEMANA.map((d, i) => (
            <div key={d} className="cr-calor-fila" role="row">
              <b>{d}</b>
              {HORAS.map((h, j) => {
                const v = matriz[i][j];
                return (
                  <i
                    key={h}
                    role="cell"
                    title={`${d} ${etiquetaHora(h)}: ${v} pedidos`}
                    style={{ background: `rgba(57, 135, 229, ${(0.08 + (v / max) * 0.92).toFixed(2)})`, '--i': i + j } as React.CSSProperties}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Bloque>
  );
}
