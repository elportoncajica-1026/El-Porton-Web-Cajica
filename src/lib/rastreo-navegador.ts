/* =============================================================
 * ENVÍO DE VISITAS Y EVENTOS (solo navegador)
 *
 * Disparar y olvidar: si algo falla (sin red, Supabase caído, almacenamiento
 * bloqueado) NO pasa nada visible. Medir jamás debe estorbar a un cliente
 * que quiere pedir.
 *
 * Usa la clave PÚBLICA y las políticas RLS dejan a `anon` solo INSERTAR en
 * `visits` y `events`; nadie sin sesión puede leerlas.
 * ============================================================= */

import { SESION_MS, esBot, leerToques, origenDe, sesionVigente, sumarToque, toqueDe, type Toques } from './rastreo';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

const VID = 'porton_vid'; // navegador → "personas", no caduca
const SID = 'porton_sid'; // visita → caduca a los 30 min
const SID_TS = 'porton_sid_ts';
const TOQUES = 'porton_toques'; // por qué red/campaña/anuncio llegó (ver rastreo.ts)

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* sigue al respaldo */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function enviar(tabla: 'visits' | 'events', cuerpo: Record<string, unknown>): void {
  if (!URL_BASE || !CLAVE) return;
  try {
    void fetch(`${URL_BASE}/rest/v1/${tabla}`, {
      method: 'POST',
      headers: {
        apikey: CLAVE,
        Authorization: `Bearer ${CLAVE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal', // anon no puede leer de vuelta
      },
      body: JSON.stringify(cuerpo),
      keepalive: true, // sobrevive a la navegación a WhatsApp
    }).catch(() => {});
  } catch {
    /* no-op */
  }
}

/** Identificadores guardados. `null` si el navegador no deja guardar: entonces no se cuenta. */
function identidad(): { vid: string; sid: string } | null {
  try {
    let vid = localStorage.getItem(VID);
    if (!vid) {
      vid = uuid();
      localStorage.setItem(VID, vid);
    }
    const ahora = Date.now();
    const previo = Number(localStorage.getItem(SID_TS)) || null;
    let sid = localStorage.getItem(SID);
    if (!sid || !sesionVigente(previo, ahora)) {
      sid = uuid();
      localStorage.setItem(SID, sid);
    }
    localStorage.setItem(SID_TS, String(ahora));
    return { vid, sid };
  } catch {
    return null; // modo privado de Safari, almacenamiento bloqueado…
  }
}

/* Dispositivos del equipo (caja, celulares de prueba) se excluyen con
   localStorage.porton_no_contar = '1', para no inflar las visitas. */
function excluido(): boolean {
  try {
    return localStorage.getItem('porton_no_contar') === '1';
  } catch {
    return false;
  }
}

const noCuenta = () => excluido() || esBot(navigator.userAgent || '', navigator.webdriver === true);

/** Toques guardados (por dónde llegó la persona). Nunca lanza. */
export function toquesGuardados(): Toques {
  try {
    return leerToques(localStorage.getItem(TOQUES));
  } catch {
    return { primero: null, ultimo: null };
  }
}

/** Lo que acompaña a cada evento: la visita y el último origen. Sin datos personales. */
function contexto(id: { vid: string; sid: string } | null): Record<string, unknown> {
  const u = toquesGuardados().ultimo;
  return {
    vid: id?.vid ?? null,
    sid: id?.sid ?? null,
    fuente: u?.fuente ?? null,
    campana: u?.campana ?? null,
    anuncio: u?.anuncio ?? null,
  };
}

/** Una carga de página. */
export function registrarVisita(): void {
  if (noCuenta()) return;
  const id = identidad();
  if (!id) return;
  try {
    const nuevo = toqueDe(document.referrer, location.hostname, location.search, Date.now());
    localStorage.setItem(TOQUES, JSON.stringify(sumarToque(toquesGuardados(), nuevo)));
  } catch {
    /* sin almacenamiento: el pedido queda "Sin dato", nada más */
  }
  // Entrada del embudo con su origen (la tabla `visits` solo guarda la red).
  enviar('events', { type: 'page_view', meta: contexto(id) });
  enviar('visits', {
    visitor_id: id.vid,
    session_id: id.sid,
    path: location.pathname || '/',
    referrer: origenDe(document.referrer, location.hostname, location.search),
  });
}

export type TipoEvento = 'add_to_cart' | 'checkout_opened' | 'order_sent' | 'whatsapp_click' | 'view_item';

/** Un paso del embudo. También refresca la visita (la actividad la mantiene viva). */
export function registrarEvento(tipo: TipoEvento, meta?: Record<string, unknown>): void {
  if (noCuenta()) return;
  enviar('events', { type: tipo, meta: { ...contexto(identidad()), ...(meta ?? {}) } });
}

export { SESION_MS };
