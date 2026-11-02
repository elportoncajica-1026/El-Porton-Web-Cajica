'use client';

/* =============================================================
 * INICIO DEL PANEL (Dashboard)
 *
 * Diseño del prototipo del cliente, con SOLO datos reales:
 *   · 4 indicadores del día elegido en el calendario (hoy por defecto)
 *     con su variación frente al día anterior
 *     (la tarjeta de "calificación promedio" del prototipo se quitó:
 *     no hay reseñas en la base).
 *   · ventas de los últimos 7 días, estado de la tienda según el
 *     horario real, pedidos recientes, platos más vendidos (30 días),
 *     actividad reciente y accesos rápidos.
 *
 * Cada bloque pide lo suyo en paralelo y, si uno falla, los demás se
 * muestran igual.
 * ============================================================= */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabaseNavegador } from '@/lib/supabase-navegador';
import { MENU } from '@/data/menu';
import { CONTACTO } from '@/data/portada';
import { estadoEn } from '@/lib/horario';
import { dinero, ETIQUETA_ESTADO, estadoDe, type Pedido } from '@/lib/pedidos-admin';
import { coordX, coordY, escalaY, formatoCorto, marcasY, rutaArea, rutaLinea, type FilaTop, type Marco, type PuntoSerie } from '@/lib/ventas';
import { diaAnterior, fechaBogota, haceCuanto, rangoDia, resumenDia, variacion, type ResumenDia } from '@/lib/panel';
import ExportarCSV from './ExportarCSV';
import SelectorDia from './SelectorDia';
import { Contador, Esqueleto } from './Animaciones';
import { Icono, type NombreIcono } from '../Iconos';

export type Seccion = 'inicio' | 'pedidos' | 'menu' | 'precios' | 'ventas' | 'visitas';

type Actividad = { cuando: string; tipo: 'pedido' | 'producto'; titulo: string; detalle: string; monto?: number };

const MARCO: Marco = { ancho: 640, alto: 230, padL: 58, padR: 16, padT: 14, padB: 28 };
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const fotoDe = (nombre: string) => {
  const p = MENU.find((m) => m.name === nombre);
  return p?.img ? (p.img.startsWith('/') ? p.img : `/${p.img}`) : null;
};

export default function Resumen({
  recargarToken,
  ir,
  nuevoProducto,
}: {
  recargarToken: number;
  ir: (s: Seccion) => void;
  nuevoProducto: () => void;
}) {
  const sb = supabaseNavegador();
  const hoy = fechaBogota(new Date());
  /* Día que se está mirando (calendario). Por defecto, hoy. */
  const [dia, setDia] = useState(hoy);
  const [serie, setSerie] = useState<PuntoSerie[] | null>(null);
  const [kpis, setKpis] = useState<{ dia: ResumenDia; antes: ResumenDia } | null>(null);
  const [delDia, setDelDia] = useState<Pedido[] | null>(null);
  const [recientes, setRecientes] = useState<Pedido[] | null>(null);
  const [top, setTop] = useState<FilaTop[] | null>(null);
  const [actividad, setActividad] = useState<Actividad[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    /* Todo el estado se fija DESPUÉS de los await y solo si el efecto
       sigue vigente (si el usuario cambia de sección a medio cargar, no se
       escribe sobre un componente que ya no está). */
    let vigente = true;
    void (async () => {
      /* Pedidos del día elegido y del anterior (para la comparación). */
      const desde = rangoDia(diaAnterior(dia)).desde.toISOString();
      const hasta = rangoDia(dia).hasta.toISOString();

      const [rSerie, rDia, rRecientes, rTop, rMenu] = await Promise.all([
        sb.rpc('ventas_serie', { p_gran: 'dia', p_periodos: 7 }),
        sb
          .from('orders')
          .select('*')
          .gte('created_at', desde)
          .lt('created_at', hasta)
          .order('created_at', { ascending: false }),
        sb.from('orders').select('*').order('created_at', { ascending: false }).limit(6),
        sb.rpc('ventas_top', { p_gran: 'dia', p_periodos: 30, p_limite: 5 }),
        sb.from('menu_items').select('id, data, updated_at').order('updated_at', { ascending: false }).limit(4),
      ]);
      if (!vigente) return;

      setAviso(rSerie.error ? 'No se pudieron leer las ventas: ' + rSerie.error.message : null);
      setSerie(rSerie.error ? [] : ((rSerie.data ?? []) as PuntoSerie[]));

      if (rDia.error) {
        setAviso('No se pudieron leer los pedidos del día: ' + rDia.error.message);
        setKpis(null);
        setDelDia([]);
      } else {
        const filas = (rDia.data ?? []) as Pedido[];
        setKpis({ dia: resumenDia(filas, dia), antes: resumenDia(filas, diaAnterior(dia)) });
        setDelDia(filas.filter((p) => fechaBogota(p.created_at) === dia));
      }

      const pedidos = (rRecientes.data ?? []) as Pedido[];
      setRecientes(rRecientes.error ? [] : pedidos);
      setTop(rTop.error ? [] : ((rTop.data ?? []) as FilaTop[]));

      const act: Actividad[] = [
        ...pedidos.slice(0, 4).map((p) => ({
          cuando: p.created_at,
          tipo: 'pedido' as const,
          titulo: 'Nuevo pedido',
          detalle: p.customer_name,
          monto: p.subtotal,
        })),
        ...((rMenu.data ?? []) as { id: string; data: { name?: string }; updated_at: string }[]).map((m) => ({
          cuando: m.updated_at,
          tipo: 'producto' as const,
          titulo: 'Producto actualizado',
          detalle: m.data?.name ?? m.id,
        })),
      ]
        .sort((a, b) => b.cuando.localeCompare(a.cuando))
        .slice(0, 5);
      setActividad(act);
    })();
    return () => {
      vigente = false;
    };
  }, [sb, recargarToken, dia]);

  const tienda = estadoEn();
  const esHoy = dia === hoy;
  const contra = esHoy ? 'ayer' : 'el día anterior';
  const [, mesDia, diaDia] = dia.split('-');
  /* Hoy: los últimos pedidos (aunque sean de ayer). Otro día: los de ese día. */
  const lista = esHoy ? recientes : delDia;

  return (
    <div className="pn-resumen">
      {aviso && <p className="login-error">{aviso}</p>}

      <SelectorDia dia={dia} onCambiar={setDia} />

      {/* ---------- indicadores ---------- */}
      <div className="pn-kpis">
        <Kpi icono="dinero" tono="rojo" titulo="Ventas del día" valor={kpis?.dia.ventas} formato={dinero} ayer={kpis?.antes.ventas} contra={contra} />
        <Kpi icono="bolsa" tono="rojo" titulo="Pedidos del día" valor={kpis?.dia.pedidos} ayer={kpis?.antes.pedidos} contra={contra} />
        <Kpi icono="usuarios" tono="ambar" titulo="Clientes únicos" valor={kpis?.dia.clientes} ayer={kpis?.antes.clientes} contra={contra} />
        <Kpi icono="recibo" tono="verde" titulo="Ticket promedio" valor={kpis?.dia.ticket} formato={dinero} ayer={kpis?.antes.ticket} contra={contra} />
      </div>

      <div className="pn-fila pn-fila--grafica">
        {/* ---------- ventas 7 días ---------- */}
        <section className="pn-tarjeta">
          <header className="pn-tarjeta-cab">
            <h3>Ventas últimos 7 días</h3>
            <button type="button" className="pn-enlace" onClick={() => ir('ventas')}>
              Ver ventas
            </button>
          </header>
          {serie ? <Grafica serie={serie} /> : <Esqueleto lineas={5} alto="1.6rem" />}
        </section>

        {/* ---------- estado de la tienda ---------- */}
        <section className="pn-tarjeta pn-tienda">
          <h3>Estado de la tienda</h3>
          <div className="pn-tienda-cuerpo">
            <div>
              <p className={`pn-tienda-estado ${tienda.abierto ? 'is-abierta' : 'is-cerrada'}`}>
                <i aria-hidden="true" /> {tienda.abierto ? 'Abierta' : 'Cerrada'}
              </p>
              <p className="pn-tenue">
                {tienda.abierto
                  ? tienda.cierraA && `Cierra hoy a las ${tienda.cierraA}`
                  : tienda.proxima && `Abre ${tienda.proxima.etiqueta} a las ${tienda.proxima.hora}`}
              </p>
              <p className="pn-tenue pn-chico">
                {CONTACTO.horario}
                <br />
                {CONTACTO.horarioNota}
              </p>
            </div>
            <div className={`pn-anillo ${tienda.abierto ? 'is-abierta' : ''}`} aria-hidden="true">
              <svg className="pn-anillo-trazo" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" pathLength={1} />
              </svg>
              <Icono nombre="tienda" size={30} />
              <small>{tienda.abierto ? 'Abierto' : 'Cerrado'}</small>
            </div>
          </div>
        </section>
      </div>

      <div className="pn-fila pn-fila--listas">
        {/* ---------- pedidos recientes ---------- */}
        <section className="pn-tarjeta">
          <header className="pn-tarjeta-cab">
            <h3>{esHoy ? 'Pedidos recientes' : `Pedidos del ${Number(diaDia)}/${Number(mesDia)}`}</h3>
            <button type="button" className="pn-enlace" onClick={() => ir('pedidos')}>
              Ver todos los pedidos
            </button>
          </header>
          {!lista ? (
            <Esqueleto lineas={4} />
          ) : !lista.length ? (
            <p className="empty-state">{esHoy ? 'Aún no hay pedidos.' : 'No hubo pedidos ese día.'}</p>
          ) : (
            <div className="pn-tabla-wrap">
              <table className="pn-tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Productos</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p, i) => (
                    <tr key={p.id} style={{ '--i': i } as React.CSSProperties}>
                      <td>{p.customer_name}</td>
                      <td className="pn-tenue">
                        {(p.items ?? []).map((it) => `${it.name} x${it.qty}`).join(', ')}
                      </td>
                      <td>{dinero(p.subtotal)}</td>
                      <td>
                        <span className={`pn-pill pn-pill--${estadoDe(p.status)}`}>{ETIQUETA_ESTADO[estadoDe(p.status)]}</span>
                      </td>
                      <td className="pn-tenue">
                        {new Date(p.created_at).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="pn-columna">
          {/* ---------- más vendidos ---------- */}
          <section className="pn-tarjeta">
            <header className="pn-tarjeta-cab">
              <h3>Más vendidos</h3>
              <span className="pn-tenue pn-chico">Últimos 30 días</span>
            </header>
            {!top ? (
              <Esqueleto lineas={4} />
            ) : !top.length ? (
              <p className="empty-state">Aún no hay ventas registradas.</p>
            ) : (
              <ol className="pn-top">
                {top.map((t, i) => {
                  const foto = fotoDe(t.producto);
                  return (
                    <li key={t.producto} style={{ '--i': i } as React.CSSProperties}>
                      <span className="pn-top-n">{i + 1}</span>
                      <span className="pn-top-foto">
                        {foto ? <Image src={foto} alt="" width={44} height={44} /> : <span>🍽️</span>}
                      </span>
                      <span className="pn-top-texto">
                        <b>{t.producto}</b>
                        <small>{t.unidades} vendidos</small>
                      </span>
                      <span className="pn-top-monto">{dinero(t.ingreso)}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* ---------- actividad ---------- */}
          <section className="pn-tarjeta">
            <h3>Actividad reciente</h3>
            {!actividad ? (
              <Esqueleto lineas={4} />
            ) : !actividad.length ? (
              <p className="empty-state">Sin actividad todavía.</p>
            ) : (
              <ul className="pn-actividad">
                {actividad.map((a, i) => (
                  <li key={i} style={{ '--i': i } as React.CSSProperties}>
                    <span className={`pn-act-icono pn-act-icono--${a.tipo}`} aria-hidden="true">
                      <Icono nombre={a.tipo === 'pedido' ? 'carrito' : 'lapiz'} size={18} />
                    </span>
                    <span className="pn-act-texto">
                      <b>{a.titulo}</b>
                      <small>
                        {a.detalle} · {haceCuanto(a.cuando)}
                      </small>
                    </span>
                    {a.monto !== undefined && <span className="pn-act-monto">{dinero(a.monto)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* ---------- accesos rápidos ---------- */}
      <section className="pn-tarjeta">
        <h3>Acciones rápidas</h3>
        <div className="pn-acciones">
          <button type="button" className="pn-accion" onClick={nuevoProducto}>
            <Icono nombre="mas" className="pn-accion-icono" size={24} />
            <b>Nuevo producto</b>
            <small>Agregar a la carta</small>
          </button>
          <button type="button" className="pn-accion" onClick={() => ir('pedidos')}>
            <Icono nombre="pedidos" className="pn-accion-icono" size={24} />
            <b>Ver pedidos</b>
            <small>Cambiar estados</small>
          </button>
          <button type="button" className="pn-accion" onClick={() => ir('menu')}>
            <Icono nombre="prohibido" className="pn-accion-icono" size={24} />
            <b>Agotar un plato</b>
            <small>Ocultarlo de la carta</small>
          </button>
          <a className="pn-accion" href="/" target="_blank" rel="noopener">
            <Icono nombre="externo" className="pn-accion-icono" size={24} />
            <b>Ver la web</b>
            <small>Como la ven los clientes</small>
          </a>
          <div className="pn-accion pn-accion--csv">
            <Icono nombre="documento" className="pn-accion-icono" size={24} />
            <b>Exportar ventas</b>
            <ExportarCSV />
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  icono,
  tono,
  titulo,
  valor,
  formato,
  ayer,
  contra = 'ayer',
}: {
  icono: NombreIcono;
  tono: 'rojo' | 'ambar' | 'verde';
  titulo: string;
  /** `undefined` mientras carga: se muestra un esqueleto. */
  valor?: number;
  formato?: (n: number) => string;
  /** Valor del día con que se compara (ayer, o el anterior al elegido). */
  ayer?: number;
  /** Cómo se nombra ese día en el texto: "ayer" o "el día anterior". */
  contra?: string;
}) {
  const hoy = valor;
  const v = hoy === undefined || ayer === undefined ? undefined : variacion(hoy, ayer);
  return (
    <div className="pn-kpi">
      <span className={`pn-kpi-icono pn-kpi-icono--${tono}`} aria-hidden="true">
        <Icono nombre={icono} size={24} />
      </span>
      <div>
        <p className="pn-kpi-titulo">{titulo}</p>
        <p className="pn-kpi-valor">
          {valor === undefined ? <Esqueleto lineas={1} alto="1.6rem" /> : <Contador valor={valor} formato={formato} />}
        </p>
        <p className={`pn-kpi-var${v === null || v === undefined ? '' : v >= 0 ? ' is-sube' : ' is-baja'}`}>
          {v === undefined ? ' ' : v === null ? `Sin datos ${contra.startsWith('el ') ? 'del ' + contra.slice(3) : 'de ' + contra}` : `${v >= 0 ? '↗' : '↘'} ${Math.abs(v)}% vs ${contra}`}
        </p>
      </div>
    </div>
  );
}

function Grafica({ serie }: { serie: PuntoSerie[] }) {
  const valores = serie.map((p) => Number(p.ingreso));
  const escala = escalaY(Math.max(0, ...valores));
  if (!valores.length) return <p className="empty-state">Sin datos.</p>;
  return (
    <svg className="pn-grafica" viewBox={`0 0 ${MARCO.ancho} ${MARCO.alto}`} role="img" aria-label="Ventas de los últimos 7 días">
      <defs>
        <linearGradient id="pnGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#E53E3E" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#E53E3E" stopOpacity="0" />
        </linearGradient>
      </defs>
      {marcasY(escala).map((m) => (
        <g key={m}>
          <line x1={MARCO.padL} x2={MARCO.ancho - MARCO.padR} y1={coordY(m, escala.tope, MARCO)} y2={coordY(m, escala.tope, MARCO)} className="pn-grafica-guia" />
          <text x={MARCO.padL - 8} y={coordY(m, escala.tope, MARCO) + 4} textAnchor="end" className="pn-grafica-eje">
            {formatoCorto(m)}
          </text>
        </g>
      ))}
      <path d={rutaArea(valores, escala.tope, MARCO)} fill="url(#pnGrad)" className="pn-grafica-area" />
      {/* pathLength="1": el trazo se anima de 0 a 1 sin medir la línea. */}
      <path d={rutaLinea(valores, escala.tope, MARCO)} className="pn-grafica-linea" pathLength={1} />
      {serie.map((p, i) => {
        const x = coordX(i, serie.length, MARCO);
        const [y, m, d] = String(p.inicio).split('-').map(Number);
        const dia = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
        return (
          <g key={p.inicio}>
            <circle
              cx={x}
              cy={coordY(Number(p.ingreso), escala.tope, MARCO)}
              r="4"
              className="pn-grafica-punto"
              style={{ '--i': i } as React.CSSProperties}
            >
              <title>{`${dia} ${d}: ${dinero(Number(p.ingreso))} · ${p.pedidos} pedidos`}</title>
            </circle>
            <text x={x} y={MARCO.alto - 6} textAnchor="middle" className="pn-grafica-eje">
              {`${dia} ${d}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
