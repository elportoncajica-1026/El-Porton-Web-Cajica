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
import { coordX, coordY, escalaY, formatoCorto, llevaEtiqueta, pasoEtiquetasX, marcasY, rutaArea, rutaLinea, type FilaTop, type Marco, type PuntoSerie } from '@/lib/ventas';
import { diaAnterior, fechaBogota, haceCuanto, rangoDia, resumenDia, variacion, type ResumenDia } from '@/lib/panel';
import { nombreConCategoria } from '@/lib/nombre-plato';
import { agrupar, etiquetaCorta, etiquetaLarga, porAnio, rangoDe, siguienteNivel, tituloZoom, type GranPunto, type Zoom } from '@/lib/grafica-zoom';
import ExportarCSV from './ExportarCSV';
import SelectorDia from './SelectorDia';
import { Contador, Esqueleto } from './Animaciones';
import { Icono, type NombreIcono } from '../Iconos';

export type Seccion = 'inicio' | 'pedidos' | 'menu' | 'precios' | 'tiempos' | 'ventas' | 'visitas' | 'crecimiento';

type Actividad = { cuando: string; tipo: 'pedido' | 'producto'; titulo: string; detalle: string; monto?: number };

const MARCO: Marco = { ancho: 640, alto: 230, padL: 58, padR: 16, padT: 14, padB: 28 };

const fotoDe = (nombre: string) => {
  const p = MENU.find((m) => m.name === nombre);
  return p?.img ? (p.img.startsWith('/') ? p.img : `/${p.img}`) : null;
};

type GranGrafica = 'dia' | 'mes' | 'anio';
const ETIQUETA_GRAFICA: Record<GranGrafica, string> = { dia: '7 días', mes: 'Por mes', anio: 'Por año' };
const TITULO_GRAFICA: Record<GranGrafica, string> = {
  dia: 'Ventas últimos 7 días',
  mes: 'Ventas por mes (últimos 12)',
  anio: 'Ventas por año',
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
  /* Ingreso de toda la historia, sin pedidos cancelados (ventas_totales). */
  const [ingresoTotal, setIngresoTotal] = useState<number | undefined>(undefined);
  /* Gráfica de ventas: últimos 7 días, últimos 12 meses o por año. */
  const [granGrafica, setGranGrafica] = useState<GranGrafica>('dia');
  /* Pila de zoom: tocar un punto baja un nivel (año → mes → día → hora). */
  const [zoom, setZoom] = useState<Zoom[]>([]);

  useEffect(() => {
    /* Todo el estado se fija DESPUÉS de los await y solo si el efecto
       sigue vigente (si el usuario cambia de sección a medio cargar, no se
       escribe sobre un componente que ya no está). */
    let vigente = true;
    void (async () => {
      /* Pedidos del día elegido y del anterior (para la comparación). */
      const desde = rangoDia(diaAnterior(dia)).desde.toISOString();
      const hasta = rangoDia(dia).hasta.toISOString();

      const [rDia, rRecientes, rTop, rMenu, rTotales] = await Promise.all([
        sb
          .from('orders')
          .select('*')
          .gte('created_at', desde)
          .lt('created_at', hasta)
          .order('created_at', { ascending: false }),
        sb.from('orders').select('*').order('created_at', { ascending: false }).limit(6),
        sb.rpc('ventas_top', { p_gran: 'dia', p_periodos: 30, p_limite: 5 }),
        sb.from('menu_items').select('id, data, updated_at').order('updated_at', { ascending: false }).limit(4),
        sb.rpc('ventas_totales'),
      ]);
      if (!vigente) return;

      setAviso(null);
      setIngresoTotal(rTotales.error ? 0 : Number((rTotales.data as { ingreso: number }[] | null)?.[0]?.ingreso ?? 0));

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

  /* Serie de la gráfica según el periodo elegido. El año se arma sumando meses
     (la base de datos agrupa por día, semana o mes). */
  useEffect(() => {
    let vigente = true;
    void (async () => {
      const z = zoom[zoom.length - 1];
      if (z) {
        /* Dentro de un zoom: los pedidos de ese periodo, agrupados aquí. */
        const { desde, hasta } = rangoDe(z);
        const r = await sb.from('orders').select('created_at, subtotal').gte('created_at', desde).lt('created_at', hasta).neq('status', 'cancelado');
        if (!vigente) return;
        if (r.error) {
          setAviso('No se pudo leer el detalle: ' + r.error.message);
          setSerie([]);
          return;
        }
        setSerie(agrupar(z, (r.data ?? []) as { created_at: string; subtotal: number }[]));
        return;
      }
      const r =
        granGrafica === 'dia'
          ? await sb.rpc('ventas_serie', { p_gran: 'dia', p_periodos: 7 })
          : await sb.rpc('ventas_serie', { p_gran: 'mes', p_periodos: granGrafica === 'mes' ? 12 : 36 });
      if (!vigente) return;
      if (r.error) {
        setAviso('No se pudieron leer las ventas: ' + r.error.message);
        setSerie([]);
        return;
      }
      const puntos = (r.data ?? []) as PuntoSerie[];
      setSerie(granGrafica === 'anio' ? porAnio(puntos) : puntos);
    })();
    return () => {
      vigente = false;
    };
  }, [sb, recargarToken, granGrafica, zoom]);

  const zoomActual = zoom[zoom.length - 1];
  const granPuntos: GranPunto = zoomActual ? zoomActual.gran : granGrafica;
  /* La gráfica se vuelve a montar (y se anima) solo cuando cambia la vista, no con cada refresco. */
  const claveVista = zoomActual ? `${zoomActual.gran}-${zoomActual.clave}` : granGrafica;

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
        <Kpi icono="dinero" tono="ambar" titulo="Ingreso total" valor={ingresoTotal} formato={dinero} nota="Desde el inicio · sin cancelados" />
        <Kpi icono="recibo" tono="verde" titulo="Ticket promedio" valor={kpis?.dia.ticket} formato={dinero} ayer={kpis?.antes.ticket} contra={contra} />
      </div>

      <div className="pn-fila pn-fila--grafica">
        {/* ---------- ventas 7 días ---------- */}
        <section className="pn-tarjeta">
          <header className="pn-tarjeta-cab">
            <div className="pn-grafica-titulo">
              {zoomActual && (
                <button type="button" className="pn-grafica-volver" onClick={() => setZoom((zs) => zs.slice(0, -1))} aria-label="Volver al nivel anterior">
                  ←
                </button>
              )}
              <h3 key={claveVista}>{zoomActual ? tituloZoom(zoomActual) : TITULO_GRAFICA[granGrafica]}</h3>
            </div>
            <div className="vt-seg" role="group" aria-label="Periodo de la gráfica">
              {(['dia', 'mes', 'anio'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={!zoomActual && granGrafica === g ? 'active' : undefined}
                  onClick={() => {
                    setGranGrafica(g);
                    setZoom([]);
                  }}
                >
                  {ETIQUETA_GRAFICA[g]}
                </button>
              ))}
            </div>
            <button type="button" className="pn-enlace" onClick={() => ir('ventas')}>
              Ver ventas
            </button>
          </header>
          {serie ? (
            <Grafica
              key={claveVista}
              serie={serie}
              gran={granPuntos}
              onElegir={(p) => {
                const z = siguienteNivel(granPuntos, String(p.inicio));
                if (z) setZoom((zs) => [...zs, z]);
              }}
            />
          ) : (
            <Esqueleto lineas={5} alto="1.6rem" />
          )}
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
                        {(p.items ?? []).map((it) => `${nombreConCategoria(it.name, it.cat)} x${it.qty}`).join(', ')}
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
  nota,
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
  /** Texto fijo en lugar de la comparación (indicadores que no son del día). */
  nota?: string;
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
          {nota ? nota : v === undefined ? ' ' : v === null ? `Sin datos ${contra.startsWith('el ') ? 'del ' + contra.slice(3) : 'de ' + contra}` : `${v >= 0 ? '↗' : '↘'} ${Math.abs(v)}% vs ${contra}`}
        </p>
      </div>
    </div>
  );
}

function Grafica({
  serie,
  gran,
  onElegir,
}: {
  serie: PuntoSerie[];
  gran: GranPunto;
  onElegir: (p: PuntoSerie) => void;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const valores = serie.map((p) => Number(p.ingreso));
  const escala = escalaY(Math.max(0, ...valores));
  if (!valores.length) return <p className="empty-state">Sin datos.</p>;

  const n = serie.length;
  const barras = gran === 'anio' || n === 1;
  const sePuedeBajar = gran !== 'hora';
  const muchos = n > 10;
  const paso = pasoEtiquetasX(n);
  const base = coordY(0, escala.tope, MARCO);
  const anchoUtil = MARCO.ancho - MARCO.padL - MARCO.padR;
  const anchoBarra = Math.min(64, (anchoUtil / n) * 0.55);

  /* Detalle flotante del punto activo (mouse o dedo). */
  const tip = activo === null ? null : (() => {
    const p = serie[activo];
    const x = coordX(activo, n, MARCO);
    const y = coordY(Number(p.ingreso), escala.tope, MARCO);
    const lineas = [etiquetaLarga(gran, String(p.inicio)), `${dinero(Number(p.ingreso))} · ${p.pedidos} pedido${Number(p.pedidos) === 1 ? '' : 's'}`];
    if (sePuedeBajar) lineas.push('Toca para ver el detalle');
    const w = Math.max(...lineas.map((l) => l.length)) * 6.4 + 22;
    const h = lineas.length * 16 + 12;
    const tx = Math.min(Math.max(x - w / 2, MARCO.padL), MARCO.ancho - MARCO.padR - w);
    const ty = y - h - 14 < 2 ? y + 14 : y - h - 14;
    return { x, y, lineas, w, h, tx, ty };
  })();

  return (
    <div className="pn-grafica-caja">
      <svg
        className={`pn-grafica${sePuedeBajar ? ' is-navegable' : ''}`}
        viewBox={`0 0 ${MARCO.ancho} ${MARCO.alto}`}
        role="img"
        aria-label="Gráfica de ventas"
        onPointerLeave={() => setActivo(null)}
      >
        <defs>
          <linearGradient id="pnGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#E53E3E" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E53E3E" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pnBarra" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#E53E3E" />
            <stop offset="100%" stopColor="#E53E3E" stopOpacity="0.35" />
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

        {tip && <line x1={tip.x} x2={tip.x} y1={MARCO.padT} y2={base} className="pn-grafica-cursor" />}

        {!barras && (
          <>
            <path d={rutaArea(valores, escala.tope, MARCO)} fill="url(#pnGrad)" className="pn-grafica-area" />
            {/* pathLength="1": el trazo se anima de 0 a 1 sin medir la línea. */}
            <path d={rutaLinea(valores, escala.tope, MARCO)} className="pn-grafica-linea" pathLength={1} />
          </>
        )}

        {serie.map((p, i) => {
          const x = coordX(i, n, MARCO);
          const y = coordY(Number(p.ingreso), escala.tope, MARCO);
          const elegir = () => sePuedeBajar && onElegir(p);
          return (
            <g key={p.inicio}>
              {barras ? (
                <>
                  <rect
                    x={x - anchoBarra / 2}
                    y={Math.min(y, base - 2)}
                    width={anchoBarra}
                    height={Math.max(base - y, 2)}
                    rx="6"
                    fill="url(#pnBarra)"
                    className={`pn-grafica-barra${activo === i ? ' is-activo' : ''}`}
                    style={{ '--i': i } as React.CSSProperties}
                  />
                  <text x={x} y={Math.min(y, base - 2) - 8} textAnchor="middle" className="pn-grafica-valor" style={{ '--i': i } as React.CSSProperties}>
                    {formatoCorto(Number(p.ingreso))}
                  </text>
                </>
              ) : (
                <>
                  {activo === i && <circle cx={x} cy={y} r="11" className="pn-grafica-halo" />}
                  <circle cx={x} cy={y} r="4" className="pn-grafica-punto" style={{ '--i': i } as React.CSSProperties} />
                </>
              )}
              {llevaEtiqueta(i, n, paso) && (
                <text x={x} y={MARCO.alto - 6} textAnchor="middle" className={`pn-grafica-eje${activo === i ? ' is-activo' : ''}`}>
                  {etiquetaCorta(gran, String(p.inicio), muchos)}
                </text>
              )}
              {/* Zona táctil generosa: toda la franja vertical del punto. */}
              <rect
                x={x - Math.max(anchoUtil / n, 24) / 2}
                y={MARCO.padT}
                width={Math.max(anchoUtil / n, 24)}
                height={base - MARCO.padT + 6}
                className="pn-grafica-hit"
                role={sePuedeBajar ? 'button' : undefined}
                tabIndex={sePuedeBajar ? 0 : undefined}
                aria-label={`${etiquetaLarga(gran, String(p.inicio))}: ${dinero(Number(p.ingreso))}`}
                onPointerEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                onClick={elegir}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    elegir();
                  }
                }}
              />
            </g>
          );
        })}

        {tip && (
          <g className="pn-grafica-tip" pointerEvents="none">
            <rect x={tip.tx} y={tip.ty} width={tip.w} height={tip.h} rx="10" />
            {tip.lineas.map((l, k) => (
              <text key={k} x={tip.tx + 11} y={tip.ty + 20 + k * 16} className={k === 0 ? 'is-titulo' : k === 2 ? 'is-pista' : undefined}>
                {l}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
