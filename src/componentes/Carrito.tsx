'use client';

/* =============================================================
 * CARRITO: botón flotante + cajón + checkout
 *
 * Cierra el circuito del pedido. El envío hace algo que v1 no hace:
 *
 *   v1  → arma el mensaje de WhatsApp con los precios del NAVEGADOR
 *         y, en paralelo, manda el pedido a Supabase (fire-and-forget).
 *   aquí→ llama a /api/pedidos, el servidor recalcula, y el mensaje se
 *         arma con lo que devuelve el SERVIDOR.
 *
 * Y si el servidor no contesta, el pedido NO se bloquea: se abre
 * WhatsApp igualmente con los precios del navegador. Perder una venta
 * por una incidencia de infraestructura sería peor que registrarla
 * tarde.
 * ============================================================= */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { BRAND } from '@/data/menu';
import { CLAVE_FORMULARIO, FORMULARIO_VACIO, type DatosFormulario } from '@/types/carrito';
import { useCarrito } from '@/estado/carrito';
import { camposIncompletos, detallesDe, formatearMiles, leerFormulario } from '@/lib/formulario';
import { construirMensaje, urlWhatsApp, type LineaPedido } from '@/lib/whatsapp';
import { registrarEvento } from '@/lib/rastreo-navegador';
import { TIPO_PEDIDO, TIPOS_EN_CARRITO, seOfreceEnCarrito } from '@/lib/tipo-pedido';
import { TIEMPOS_POR_DEFECTO, textoAviso, type Tiempos } from '@/lib/tiempos';
import { CONTACTO, RESENA_GOOGLE, SEGUIR } from '@/data/portada';
import { Icono } from './Iconos';

const fmt = (n: number) => '$' + n.toLocaleString('es-CO');
const TELEFONO = (BRAND as { whatsapp: string }).whatsapp;

/* El enlace de WhatsApp del último pedido se recuerda un rato (solo en esta
   pestaña) para poder volver a abrirlo si no se abrió o si no se tocó Enviar. */
const CLAVE_ULTIMO_ENVIO = 'porton_ultimo_envio';
const VIGENCIA_ENVIO_MS = 90 * 60 * 1000;
const PREFIJO_ENLACE = 'https://api.whatsapp.com/send';

export default function Carrito({ tiempos = TIEMPOS_POR_DEFECTO }: { tiempos?: Tiempos }) {
  const { items, subtotal, unidades, hidratado, cambiarQty, quitar, vaciar } = useCarrito();
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<DatosFormulario>(FORMULARIO_VACIO);
  const [consiente, setConsiente] = useState(false);
  const [intento, setIntento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rebote, setRebote] = useState(false);
  /* Enlace de WhatsApp del pedido recién enviado (null = ninguno). */
  const [enviado, setEnviado] = useState<string | null>(null);
  /* Segunda cara: agradecimiento + seguirnos + reseña (tras tocar "Ya lo envié"). */
  const [gracias, setGracias] = useState(false);
  const trampa = useRef<HTMLInputElement>(null);

  /* Datos del cliente guardados (solo en el navegador). */
  useEffect(() => {
    try {
      setDatos(leerFormulario(localStorage.getItem(CLAVE_FORMULARIO)));
    } catch {
      /* almacenamiento bloqueado: se sigue con el formulario vacío */
    }
  }, []);

  /* Si la pestaña se recargó al volver de WhatsApp, se recupera el último paso. */
  useEffect(() => {
    try {
      const crudo = sessionStorage.getItem(CLAVE_ULTIMO_ENVIO);
      if (!crudo) return;
      const g = JSON.parse(crudo) as { url?: string; ts?: number };
      if (g.url?.startsWith(PREFIJO_ENLACE) && g.ts && Date.now() - g.ts < VIGENCIA_ENVIO_MS) setEnviado(g.url);
      else sessionStorage.removeItem(CLAVE_ULTIMO_ENVIO);
    } catch {
      /* almacenamiento bloqueado: simplemente no se recupera */
    }
  }, []);

  function descartarEnvio() {
    setEnviado(null);
    try {
      sessionStorage.removeItem(CLAVE_ULTIMO_ENVIO);
    } catch {
      /* nada que hacer */
    }
  }

  /* Si la persona empieza otro pedido, el aviso del anterior sobra. */
  useEffect(() => {
    if (items.length > 0 && enviado) descartarEnvio();
    if (items.length > 0 && gracias) setGracias(false);
  }, [items.length, enviado, gracias]);

  /* Al cerrar el cajón, la segunda cara no se queda esperando. */
  useEffect(() => {
    if (!abierto) setGracias(false);
  }, [abierto]);

  /* Animación del botón flotante al añadir algo. */
  const unidadesPrevias = useRef(0);
  useEffect(() => {
    if (unidades > unidadesPrevias.current) {
      setRebote(true);
      const t = setTimeout(() => setRebote(false), 400);
      unidadesPrevias.current = unidades;
      return () => clearTimeout(t);
    }
    unidadesPrevias.current = unidades;
  }, [unidades]);

  /* Escape cierra el cajón. */
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('keydown', alPulsar);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alPulsar);
      document.body.style.overflow = '';
    };
  }, [abierto]);

  function actualizar(parcial: Partial<DatosFormulario>) {
    const nuevos = { ...datos, ...parcial };
    setDatos(nuevos);
    try {
      // Solo se recuerdan los datos de la persona, nunca el pago.
      localStorage.setItem(
        CLAVE_FORMULARIO,
        JSON.stringify({ nombre: nuevos.nombre, telefono: nuevos.telefono, direccion: nuevos.direccion }),
      );
    } catch {
      /* sin persistencia: el pedido funciona igual */
    }
  }

  const faltanCampos = camposIncompletos(datos);
  // Un carrito guardado con un tipo que ya no se ofrece vuelve a domicilio.
  const tipo = seOfreceEnCarrito(datos.tipo) ? datos.tipo : 'domicilio';
  const aDomicilio = tipo === 'domicilio';
  const avisoTiempo = textoAviso(tipo, tiempos[tipo]);

  async function enviar() {
    setIntento(true);
    setAviso(null);
    if (!items.length || faltanCampos.length || !consiente) return;

    setEnviando(true);
    let lineas: LineaPedido[] = items as unknown as LineaPedido[];
    let totalFinal = subtotal;

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, items, sitio_web: trampa.current?.value ?? '' }),
      });
      const j = await res.json();

      if (!res.ok || !j.ok) {
        // El servidor rechaza el pedido: son datos mal formados, no
        // una incidencia. Aquí SÍ se para, porque enviarlo por
        // WhatsApp llevaría a preparar algo incorrecto.
        setEnviando(false);
        setAviso((j.errores ?? ['No se pudo procesar el pedido.']).join(' '));
        return;
      }

      // Los precios del servidor mandan sobre los del navegador.
      lineas = j.items as LineaPedido[];
      totalFinal = j.subtotal as number;
      if (!j.guardado) {
        console.warn('[carrito] el pedido no se registró en la base de datos, pero se envía igual.');
      }
    } catch {
      // Ni siquiera se pudo hablar con el servidor. NO se bloquea la
      // venta: se sigue con los datos del navegador.
      console.warn('[carrito] sin respuesta del servidor; se envía con los precios del navegador.');
    }

    registrarEvento('order_sent', { total: totalFinal });
    const enlace = urlWhatsApp(construirMensaje(lineas, datos, totalFinal), TELEFONO);
    // Se intenta abrir WhatsApp solo, pero los navegadores del celular a
    // veces lo bloquean (la ventana se abre tras esperar al servidor) y
    // además la persona tiene que tocar "Enviar" dentro de WhatsApp. Por eso
    // el cajón NO se cierra: queda el botón "Abrir WhatsApp" a la vista.
    window.open(enlace, '_blank');
    setEnviado(enlace);
    try {
      sessionStorage.setItem(CLAVE_ULTIMO_ENVIO, JSON.stringify({ url: enlace, ts: Date.now() }));
    } catch {
      /* sin persistencia: el aviso se muestra igual mientras la pestaña siga abierta */
    }

    vaciar();
    setEnviando(false);
    setIntento(false);
  }

  const puedeEnviar = items.length > 0 && faltanCampos.length === 0 && consiente && !enviando;

  return (
    <>
      {/* ---------- botón flotante ---------- */}
      {hidratado && (
        <button
          id="cart-fab"
          type="button"
          className={`cart-fab${rebote ? ' bump' : ''}`}
          aria-label="Ver tu pedido"
          onClick={() => {
            setAbierto(true);
            registrarEvento('checkout_opened');
          }}
        >
          <span className="cart-fab-count">{unidades}</span>
          <span className="cart-fab-icon" aria-hidden="true">
            🛒
          </span>
          <span className="cart-fab-total">{fmt(subtotal)}</span>
        </button>
      )}

      {/* ---------- cajón ---------- */}
      <div
        id="cart-overlay"
        className={`cart-overlay${abierto ? ' open' : ''}`}
        onClick={() => setAbierto(false)}
        aria-hidden="true"
      />

      <aside id="cart-drawer" className={`cart-drawer${abierto ? ' open' : ''}`} aria-label="Tu pedido">
        <header className="cart-head">
          <h2 className="cart-head-title">🛒 Tu Pedido</h2>
          <button type="button" className="cart-close" aria-label="Cerrar" onClick={() => setAbierto(false)}>
            ✕
          </button>
        </header>

        <div className="cart-body">
          {items.length === 0 && gracias ? (
            <div className="cart-empty cart-gracias">
              <p className="cart-empty-emoji">🙌</p>
              <p className="cart-empty-title">¡Gracias por pedir en El Portón!</p>
              <p className="cart-empty-sub">Te confirmamos por WhatsApp. Mientras tanto, acompáñanos:</p>
              <div className="cart-gracias-lista">
                {SEGUIR.map((r) => (
                  <a key={r.clave} className="cart-gracias-btn" href={r.url} target="_blank" rel="noopener">
                    <Icono nombre={r.icono} size={22} />
                    <span>
                      <strong>{r.texto}</strong>
                      <small>{r.detalle}</small>
                    </span>
                  </a>
                ))}
                <a className="cart-gracias-btn" href={RESENA_GOOGLE} target="_blank" rel="noopener">
                  <span className="cart-gracias-emoji" aria-hidden="true">
                    ⭐
                  </span>
                  <span>
                    <strong>Cuéntanos cómo te fue</strong>
                    <small>Cuando recibas tu pedido, déjanos tu reseña en Google</small>
                  </span>
                </a>
              </div>
              <button type="button" className="cart-enviado-cerrar" onClick={() => setAbierto(false)}>
                Listo
              </button>
            </div>
          ) : items.length === 0 && enviado ? (
            <div className="cart-empty cart-enviado">
              <p className="cart-empty-emoji">📲</p>
              <p className="cart-empty-title">Último paso: toca Enviar en WhatsApp</p>
              <p className="cart-empty-sub">
                Tu pedido ya está escrito en WhatsApp. Ábrelo y toca el botón verde de <strong>Enviar</strong> para
                que el restaurante lo reciba.
              </p>
              <a className="cart-send" href={enviado} target="_blank" rel="noopener">
                <span aria-hidden="true">🟢</span> Abrir WhatsApp
              </a>
              <p className="cart-enviado-nota">¿No se abrió solo? Toca el botón de arriba.</p>
              <button
                type="button"
                className="cart-enviado-cerrar"
                onClick={() => {
                  descartarEnvio();
                  setGracias(true);
                }}
              >
                Ya lo envié
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="cart-empty">
              <p className="cart-empty-emoji">🛍️</p>
              <p className="cart-empty-title">Tu pedido está vacío</p>
              <p className="cart-empty-sub">Agrega algo delicioso del menú 😋</p>
              <button
                type="button"
                className="cart-empty-btn"
                onClick={() => {
                  setAbierto(false);
                  document.getElementById('menu-catalogo')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Ver el menú
              </button>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {items.map((it) => {
                  const detalle = detallesDe(it);
                  return (
                    <div className="cart-item" key={it.hash}>
                      <div className="cart-item-media">
                        {it.img ? (
                          <Image
                            src={it.img.startsWith('/') ? it.img : `/${it.img}`}
                            alt=""
                            width={64}
                            height={64}
                          />
                        ) : (
                          it.emoji
                        )}
                      </div>
                      <div className="cart-item-main">
                        <div className="cart-item-top">
                          <h4 className="cart-item-name">{it.name}</h4>
                          <button
                            type="button"
                            className="cart-item-del"
                            aria-label={`Eliminar ${it.name}`}
                            onClick={() => quitar(it.hash)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                        {detalle && <p className="cart-item-details">{detalle}</p>}
                        <div className="cart-item-bottom">
                          <div className="qty">
                            <button type="button" className="qty-btn" aria-label="Quitar uno" onClick={() => cambiarQty(it.hash, -1)}>
                              −
                            </button>
                            <span className="qty-val">{it.qty}</span>
                            <button type="button" className="qty-btn" aria-label="Agregar uno" onClick={() => cambiarQty(it.hash, 1)}>
                              +
                            </button>
                          </div>
                          <span className="cart-item-price">{fmt(it.unitPrice * it.qty)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ---------- datos de despacho ---------- */}
              <form className="cart-form" autoComplete="on" onSubmit={(e) => e.preventDefault()}>
                {/* ¿Cómo recibe el pedido? Lo primero que se decide. */}
                <div className="cart-field">
                  <span>¿Cómo quieres tu pedido?</span>
                  <div className="pago-opts tipo-opts" role="group" aria-label="Cómo quieres tu pedido">
                    {TIPOS_EN_CARRITO.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`pago-opt tipo-opt${tipo === t ? ' is-selected' : ''}`}
                        aria-pressed={tipo === t}
                        aria-label={TIPO_PEDIDO[t].etiqueta}
                        onClick={() => actualizar({ tipo: t })}
                      >
                        <span className="tipo-icono" aria-hidden="true">
                          {TIPO_PEDIDO[t].icono}
                        </span>
                        <span>{TIPO_PEDIDO[t].boton}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <h3 className="cart-form-title">{aDomicilio ? '📦 Datos de envío' : '🙋 Tus datos'}</h3>

                <Campo
                  etiqueta="Nombre completo"
                  error={intento && !datos.nombre.trim()}
                  tipo="text"
                  nombre="nombre"
                  autoComplete="name"
                  marcador="Tu nombre"
                  valor={datos.nombre}
                  onCambio={(v) => actualizar({ nombre: v })}
                />
                <Campo
                  etiqueta="Teléfono de contacto"
                  error={intento && !datos.telefono.trim()}
                  tipo="tel"
                  nombre="telefono"
                  autoComplete="tel"
                  marcador="3xx xxx xxxx"
                  valor={datos.telefono}
                  onCambio={(v) => actualizar({ telefono: v })}
                />
                {aDomicilio ? (
                  <Campo
                    etiqueta="Dirección de entrega"
                    error={intento && !datos.direccion.trim()}
                    tipo="text"
                    nombre="direccion"
                    autoComplete="street-address"
                    marcador="Calle, número, barrio…"
                    valor={datos.direccion}
                    onCambio={(v) => actualizar({ direccion: v })}
                  />
                ) : (
                  <>
                    <p className="cart-local">
                      📍 Te esperamos en <strong>{CONTACTO.direccion.replace(/\.$/, '')}, Cajicá</strong>
                    </p>
                    <label className="cart-field">
                      <span>¿A qué hora llegas? (opcional)</span>
                      <input
                        type="time"
                        name="hora"
                        value={datos.hora ?? ''}
                        onChange={(e) => actualizar({ hora: e.target.value })}
                      />
                    </label>
                  </>
                )}

                <div className={`cart-field${intento && !datos.pago ? ' field-error' : ''}`}>
                  <span>Método de pago</span>
                  <div className="pago-opts">
                    {['Tarjeta / Transferencia', 'Efectivo'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`pago-opt${datos.pago === p ? ' is-selected' : ''}`}
                        aria-pressed={datos.pago === p}
                        onClick={() => actualizar({ pago: p, cambio: p === 'Efectivo' ? datos.cambio : '' })}
                      >
                        <span>{p}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {datos.pago === 'Efectivo' && (
                  <label className="cart-field">
                    <span>¿Con cuánto vas a pagar?</span>
                    <input
                      type="text"
                      name="cambio"
                      inputMode="numeric"
                      placeholder="Ej: $50.000"
                      value={datos.cambio}
                      onChange={(e) => actualizar({ cambio: formatearMiles(e.target.value) })}
                    />
                  </label>
                )}

                <label className={`cart-consent${intento && !consiente ? ' field-error' : ''}`}>
                  <input type="checkbox" checked={consiente} onChange={(e) => setConsiente(e.target.checked)} />
                  <span>
                    Autorizo a <strong>El Portón Cajicá</strong> a tratar mis datos personales (nombre, teléfono y
                    dirección) con la única finalidad de gestionar, entregar y hacer seguimiento a este pedido,
                    conforme a la Ley 1581 de 2012. Puedo pedir su consulta, actualización o supresión en cualquier
                    momento por WhatsApp.{' '}
                    <a href="/legal#datos" target="_blank" rel="noopener">
                      Ver política de datos
                    </a>
                  </span>
                </label>

                {/* Trampa anti-bots: fuera de pantalla, sin foco y oculta para lectores
                    de pantalla. Una persona nunca la rellena; un bot sí. */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                  <label>
                    No escribas aquí
                    <input ref={trampa} type="text" name="sitio_web" tabIndex={-1} autoComplete="off" defaultValue="" />
                  </label>
                </div>
              </form>
            </>
          )}
        </div>

        {items.length > 0 && (
          <footer className="cart-foot">
            <div className="cart-total-row">
              <span>Total productos</span>
              <span className="cart-total">{fmt(subtotal)}</span>
            </div>
            {/* Cuánto tarda (editable en el panel → Tiempos). */}
            <p className="cart-aviso-tiempo">
              ⏱️ {avisoTiempo.inicio}
              <strong>{avisoTiempo.tiempo}</strong>
              {avisoTiempo.fin}
            </p>
            {aDomicilio && (
              <p className="cart-aviso-domicilio">
                ⚠️ El valor del domicilio <strong>NO está incluido</strong>. Te lo confirma el asesor por WhatsApp.
              </p>
            )}
            {aviso && (
              <p className="cart-aviso" role="alert">
                ⚠️ {aviso}
              </p>
            )}
            <button type="button" className="cart-send" onClick={enviar} disabled={enviando}>
              <span aria-hidden="true">🟢</span>{' '}
              {enviando ? 'Enviando…' : 'Enviar pedido por WhatsApp'}
            </button>
            {intento && !puedeEnviar && !enviando && (
              <p className="cart-aviso" role="alert">
                {faltanCampos.length
                  ? aDomicilio
                    ? 'Completa tus datos de envío para continuar.'
                    : 'Completa tus datos para continuar.'
                  : !consiente
                    ? 'Debes autorizar el tratamiento de datos para enviar el pedido.'
                    : ''}
              </p>
            )}
          </footer>
        )}
      </aside>
    </>
  );
}

function Campo({
  etiqueta,
  tipo,
  nombre,
  autoComplete,
  marcador,
  valor,
  onCambio,
  error,
}: {
  etiqueta: string;
  tipo: string;
  nombre: string;
  autoComplete: string;
  marcador: string;
  valor: string;
  onCambio: (v: string) => void;
  error?: boolean;
}) {
  return (
    <label className={`cart-field${error ? ' field-error' : ''}`}>
      <span>{etiqueta}</span>
      <input
        type={tipo}
        name={nombre}
        autoComplete={autoComplete}
        placeholder={marcador}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
      />
    </label>
  );
}
