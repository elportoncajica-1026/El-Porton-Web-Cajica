'use client';

/* =============================================================
 * PANEL ADMINISTRATIVO
 *
 * Todo el panel es de cliente, y aquí sí es lo correcto: está detrás
 * de un inicio de sesión, no lo indexa nadie y es interacción de
 * principio a fin. Es justo lo contrario de la página pública.
 *
 * ⚠️ Lo que llega al navegador SIN sesión es un formulario y nada más:
 * los datos se piden después de autenticarse, y quien los protege son
 * las políticas RLS de la base — no el hecho de esconder la pantalla.
 *
 * Rediseño 2026-10 (prototipo del cliente): menú lateral + cabecera +
 * inicio con resumen. El menú lateral muestra SOLO secciones que
 * funcionan de verdad (decisión del cliente): nada de botones vacíos.
 * Fondo liso como el prototipo (el cliente pidió quitar los puntos
 * interactivos que había antes).
 * ============================================================= */

import { useEffect, useRef, useState } from 'react';
import { useSesionAdmin } from '@/estado/sesion-admin';
import { supabaseNavegador } from '@/lib/supabase-navegador';
import { estadoEn } from '@/lib/horario';
import { fechaLarga } from '@/lib/panel';
import { dinero } from '@/lib/pedidos-admin';
import { tituloConAviso } from '@/lib/vigia-pedidos';
import { desbloquearSonido, sonidoDisponible, tocarCampana } from '@/lib/campana';
import { useVigiaPedidos, type PedidoLlegado } from '@/estado/vigia-pedidos';
import { Login, RetoMFA } from '@/componentes/admin/Acceso';
import Pedidos from '@/componentes/admin/Pedidos';
import Analitica from '@/componentes/admin/Analitica';
import Visitas from '@/componentes/admin/Visitas';
import Origenes from '@/componentes/admin/Origenes';
import PreciosPos from '@/componentes/admin/PreciosPos';
import Tiempos from '@/componentes/admin/Tiempos';
import Menu from '@/componentes/admin/Menu';
import Resumen, { type Seccion } from '@/componentes/admin/Resumen';
import ModalSeguridad from '@/componentes/admin/ModalSeguridad';
import { Icono, type NombreIcono } from '@/componentes/Iconos';

const TITULOS: Record<Seccion, { titulo: string; sub: string }> = {
  inicio: { titulo: 'Inicio', sub: 'Resumen general de tu negocio' },
  pedidos: { titulo: 'Pedidos', sub: 'Cambia el estado de cada pedido con un toque' },
  menu: { titulo: 'Menú', sub: 'Precios, fotos, descripciones y platos agotados' },
  precios: { titulo: 'Precios POS', sub: 'Ajusta los precios de la carta con la plantilla de VectorPOS' },
  tiempos: { titulo: 'Tiempos de entrega', sub: 'Lo que el carrito promete: domicilio y recoger en el local' },
  ventas: { titulo: 'Ventas', sub: 'Ingresos, productos más vendidos y exportación' },
  visitas: { titulo: 'Visitas', sub: 'Cuántas personas entran a la web' },
};

const GRUPOS: { titulo?: string; items: { id: Seccion; texto: string; icono: NombreIcono }[] }[] = [
  { items: [{ id: 'inicio', texto: 'Inicio', icono: 'inicio' }] },
  {
    titulo: 'Gestión',
    items: [
      { id: 'pedidos', texto: 'Pedidos', icono: 'pedidos' },
      { id: 'menu', texto: 'Menú', icono: 'carta' },
      { id: 'precios', texto: 'Precios POS', icono: 'etiqueta' },
      { id: 'tiempos', texto: 'Tiempos', icono: 'reloj' },
    ],
  },
  {
    titulo: 'Analítica',
    items: [
      { id: 'ventas', texto: 'Ventas', icono: 'grafica' },
      { id: 'visitas', texto: 'Visitas', icono: 'ojo' },
    ],
  },
];

export default function PanelAdmin() {
  const { estado, correo, factorId, error, revisar, salir } = useSesionAdmin();
  const [seccion, setSeccion] = useState<Seccion>('inicio');
  /* Cambiar este número hace que las secciones vuelvan a pedir sus datos.
     Es más simple que pasar una función de recarga a cada una. */
  const [recargarToken, setRecargar] = useState(0);
  const [seguridadAbierta, setSeguridadAbierta] = useState(false);
  const [lateralAbierto, setLateralAbierto] = useState(false);
  const [creandoProducto, setCreandoProducto] = useState(false);
  const [nuevos, setNuevos] = useState<number | null>(null);
  const [contadorToken, setContadorToken] = useState(0);

  /* Pedidos sin atender: la insignia del menú y la campana. Se pide solo
     el número (head: true), no las filas. */
  useEffect(() => {
    if (estado !== 'dentro') return;
    let vigente = true;
    void (async () => {
      const { count } = await supabaseNavegador()
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'nuevo');
      if (vigente) setNuevos(count ?? 0);
    })();
    return () => {
      vigente = false;
    };
  }, [estado, recargarToken, contadorToken]);

  /* ---------- Pedidos en vivo: campana, aviso y notificación ----------
     El vigía consulta cada 10 s (estado/vigia-pedidos.ts). Al llegar un
     pedido se refrescan solos el contador y la sección abierta. */
  const [sonido, setSonido] = useState(() => {
    try {
      return localStorage.getItem('panel-sonido') !== 'no';
    } catch {
      return true;
    }
  });
  const [sonidoBloqueado, setSonidoBloqueado] = useState(false);
  const [avisos, setAvisos] = useState<PedidoLlegado[]>([]);
  const tituloBase = useRef<string | null>(null);

  useVigiaPedidos(estado === 'dentro', (llegados) => {
    setContadorToken((n) => n + 1);
    if (seccion === 'inicio' || seccion === 'pedidos' || seccion === 'ventas') setRecargar((n) => n + 1);
    setAvisos((previos) => [...[...llegados].reverse(), ...previos].slice(0, 3));

    if (sonido) {
      if (sonidoDisponible()) tocarCampana();
      else setSonidoBloqueado(true);
    }

    // Con la pestaña en segundo plano, además, notificación del sistema.
    const ultimo = llegados[llegados.length - 1];
    if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(
          llegados.length > 1 ? `${llegados.length} pedidos nuevos · El Portón` : 'Nuevo pedido · El Portón',
          { body: `${ultimo.customer_name} · ${dinero(ultimo.subtotal)}`, icon: '/assets/favicon-512.png', tag: ultimo.id },
        );
        n.onclick = () => {
          window.focus();
          setSeccion('pedidos');
          setAvisos([]);
          n.close();
        };
      } catch {
        /* algunos navegadores solo notifican desde un service worker */
      }
    }
  });

  // El navegador no deja sonar hasta el primer toque: se habilita ahí.
  useEffect(() => {
    if (estado !== 'dentro') return;
    const habilitar = () => {
      void desbloquearSonido().then((ok) => setSonidoBloqueado(!ok));
    };
    window.addEventListener('pointerdown', habilitar);
    window.addEventListener('keydown', habilitar);
    return () => {
      window.removeEventListener('pointerdown', habilitar);
      window.removeEventListener('keydown', habilitar);
    };
  }, [estado]);

  // "(2) Nuevo pedido · Panel…" en la pestaña mientras haya pedidos sin atender.
  // Next puede restaurar el <title> de la página por su cuenta: si lo cambia,
  // se vuelve a poner el aviso (el observador solo actúa si el texto difiere).
  useEffect(() => {
    if (estado !== 'dentro') return;
    if (tituloBase.current === null) tituloBase.current = document.title.replace(/^\(\d+\) Nuevo pedido · /, '');
    const deseado = tituloConAviso(tituloBase.current, nuevos ?? 0);
    const aplicar = () => {
      if (document.title !== deseado) document.title = deseado;
    };
    aplicar();
    const vigia = new MutationObserver(aplicar);
    vigia.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => vigia.disconnect();
  }, [estado, nuevos]);

  async function alternarSonido() {
    const activar = !sonido;
    setSonido(activar);
    try {
      localStorage.setItem('panel-sonido', activar ? 'si' : 'no');
    } catch {
      /* sin almacenamiento: vale solo para esta visita */
    }
    if (!activar) return;
    const ok = await desbloquearSonido();
    setSonidoBloqueado(!ok);
    if (ok) tocarCampana(); // prueba: así saben cómo suena
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        /* el navegador no permite pedirlo */
      }
    }
  }

  if (estado === 'cargando') {
    return (
      <>
        <div id="login-view" className="admin-login">
          <p className="loading">Cargando…</p>
        </div>
      </>
    );
  }

  if (estado === 'fuera') {
    return (
      <>
        <Login alEntrar={revisar} avisoPrevio={error} />
      </>
    );
  }

  if (estado === 'mfa' && factorId) {
    return (
      <>
        <RetoMFA factorId={factorId} alVerificar={revisar} alCancelar={salir} />
      </>
    );
  }

  function ir(s: Seccion) {
    if (s === 'pedidos') setAvisos([]);
    setCreandoProducto(false);
    setSeccion(s);
    setLateralAbierto(false);
    window.scrollTo({ top: 0 });
  }

  const tienda = estadoEn();
  const { titulo, sub } = TITULOS[seccion];

  return (
    <>
      <div id="dash-view" className="pn">
        {/* ---------- menú lateral ---------- */}
        <aside className={`pn-lateral${lateralAbierto ? ' is-abierto' : ''}`} aria-label="Menú del panel">
          <div className="pn-lateral-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-final.png" alt="El Portón" />
          </div>

          <nav className="pn-nav">
            {GRUPOS.map((g, i) => (
              <div key={i} className="pn-nav-grupo">
                {g.titulo && <p className="pn-nav-titulo">{g.titulo}</p>}
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className={`pn-nav-item${seccion === it.id ? ' is-activo' : ''}`}
                    aria-current={seccion === it.id ? 'page' : undefined}
                    onClick={() => ir(it.id)}
                  >
                    <Icono nombre={it.icono} size={19} />
                    <span>{it.texto}</span>
                    {it.id === 'pedidos' && !!nuevos && <span className="pn-insignia">{nuevos}</span>}
                  </button>
                ))}
              </div>
            ))}

            <div className="pn-nav-grupo">
              <p className="pn-nav-titulo">Cuenta</p>
              <button type="button" className="pn-nav-item" onClick={() => setSeguridadAbierta(true)}>
                <Icono nombre="candado" size={19} />
                <span>Seguridad</span>
              </button>
              <a className="pn-nav-item" href="/" target="_blank" rel="noopener">
                <Icono nombre="externo" size={19} />
                <span>Ver la web</span>
              </a>
              <button type="button" className="pn-nav-item" onClick={() => void salir()}>
                <Icono nombre="salir" size={19} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </nav>

          <div className={`pn-lateral-tienda ${tienda.abierto ? 'is-abierta' : 'is-cerrada'}`}>
            <p>
              <i aria-hidden="true" /> {tienda.abierto ? 'Tienda abierta' : 'Tienda cerrada'}
            </p>
            <small>
              {tienda.abierto
                ? tienda.cierraA && `Cierra hoy a las ${tienda.cierraA}`
                : tienda.proxima && `Abre ${tienda.proxima.etiqueta} a las ${tienda.proxima.hora}`}
            </small>
          </div>
        </aside>
        {lateralAbierto && <div className="pn-velo" onClick={() => setLateralAbierto(false)} aria-hidden="true" />}

        {/* ---------- contenido ---------- */}
        <div className="pn-principal">
          <header className="pn-cabecera">
            <button
              type="button"
              className="pn-icono-btn pn-solo-movil"
              aria-label="Abrir menú"
              onClick={() => setLateralAbierto(true)}
            >
              <Icono nombre="hamburguesaMenu" size={22} />
            </button>
            {/* `key`: al cambiar de sección el título vuelve a entrar animado. */}
            <div className="pn-cabecera-titulo pn-entra" key={seccion}>
              <h1>{titulo}</h1>
              <p>{seccion === 'inicio' ? `${sub} · ${fechaLarga()}` : sub}</p>
            </div>
            <span className="spacer" />
            <button
              type="button"
              className="pn-icono-btn"
              aria-label="Actualizar datos"
              title="Actualizar"
              onClick={() => setRecargar((n) => n + 1)}
            >
              <Icono nombre="recargar" size={20} />
            </button>
            <button
              type="button"
              className={`pn-icono-btn pn-sonido${sonido && sonidoBloqueado ? ' is-bloqueado' : ''}`}
              aria-pressed={sonido}
              aria-label={sonido ? 'Sonido de pedidos activado' : 'Sonido de pedidos apagado'}
              title={
                !sonido
                  ? 'Sonido de pedidos apagado'
                  : sonidoBloqueado
                    ? 'Toca la pantalla para activar el sonido'
                    : 'Sonido de pedidos activado'
              }
              onClick={() => void alternarSonido()}
            >
              <Icono nombre={sonido ? 'sonido' : 'silencio'} size={20} />
            </button>
            <button
              type="button"
              className="pn-icono-btn pn-campana"
              aria-label={nuevos ? `${nuevos} pedidos nuevos` : 'Sin pedidos nuevos'}
              title="Pedidos nuevos"
              onClick={() => ir('pedidos')}
            >
              <Icono nombre="campana" size={20} />
              {!!nuevos && <span className="pn-insignia pn-insignia--flotante">{nuevos}</span>}
            </button>
            <div className="pn-usuario" title={correo ?? ''}>
              <span className="pn-avatar" aria-hidden="true">
                {(correo ?? 'A').charAt(0).toUpperCase()}
              </span>
              <span className="pn-usuario-texto">
                <b>Admin</b>
                <small>{correo}</small>
              </span>
            </div>
          </header>

          {/* `key={seccion}` rehace el bloque al cambiar de sección, así la
              entrada en cascada (estilos-panel.css) se repite cada vez. */}
          <main className="pn-contenido pn-seccion" key={seccion}>
            {seccion === 'inicio' && (
              <Resumen
                recargarToken={recargarToken}
                ir={ir}
                nuevoProducto={() => {
                  ir('menu');
                  setCreandoProducto(true);
                }}
              />
            )}
            {seccion === 'pedidos' && (
              <Pedidos recargarToken={recargarToken} alCambiar={() => setContadorToken((n) => n + 1)} />
            )}
            {seccion === 'menu' && <Menu recargarToken={recargarToken} iniciarCreando={creandoProducto} />}
            {seccion === 'precios' && <PreciosPos recargarToken={recargarToken} />}
            {seccion === 'tiempos' && <Tiempos recargarToken={recargarToken} />}
            {seccion === 'ventas' && <Analitica recargarToken={recargarToken} incluirVisitas={false} />}
            {seccion === 'visitas' && (
              <>
                <div className="panel-box">
                  <h3>Visitas a la página</h3>
                  <Visitas recargarToken={recargarToken} />
                </div>
                <Origenes recargarToken={recargarToken} />
              </>
            )}
          </main>
        </div>

        {/* Aviso de pedido nuevo: queda hasta que lo atiendan (máx. 3). */}
        {avisos.length > 0 && (
          <div className="pn-avisos" role="status" aria-live="assertive">
            {avisos.map((a) => (
              <div className="pn-aviso" key={a.id}>
                <span className="pn-aviso-icono" aria-hidden="true">
                  <Icono nombre="campana" size={20} />
                </span>
                <button type="button" className="pn-aviso-cuerpo" onClick={() => ir('pedidos')}>
                  <b>Nuevo pedido</b>
                  <span>
                    {a.customer_name} · {dinero(a.subtotal)}
                  </span>
                  {sonido && sonidoBloqueado && <small>Toca la pantalla para activar el sonido</small>}
                </button>
                <button
                  type="button"
                  className="pn-aviso-cerrar"
                  aria-label="Cerrar aviso"
                  onClick={() => setAvisos((v) => v.filter((x) => x.id !== a.id))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {seguridadAbierta && <ModalSeguridad alCerrar={() => setSeguridadAbierta(false)} />}
      </div>
    </>
  );
}
