/* =============================================================
 * MEDICIÓN DE VISITAS — lógica pura (sin red ni navegador)
 *
 * Qué se guarda y qué NO (Ley 1581):
 *   · SÍ: un identificador aleatorio por navegador ("persona"), otro que
 *     caduca a los 30 min ("visita"), la ruta y el ORIGEN (solo el
 *     dominio, o la etiqueta del enlace: instagram, qr-bolsa…).
 *   · NO: IP, nombre, correo, teléfono ni huella del dispositivo.
 * ============================================================= */

/** Una visita termina tras 30 minutos sin actividad. */
export const SESION_MS = 30 * 60 * 1000;

/**
 * ¿Hay que abrir una visita nueva? Sí si no había, si no se sabe cuándo
 * fue la última actividad, o si pasaron más de SESION_MS.
 */
export function sesionVigente(ultimaActividad: number | null, ahora: number): boolean {
  return !!ultimaActividad && ahora - ultimaActividad <= SESION_MS;
}

/** Rastreadores y automatización: no son visitas reales y falsearían el conteo. */
export function esBot(userAgent: string, webdriver = false): boolean {
  if (webdriver) return true;
  return /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|preview|facebookexternalhit|whatsapp/i.test(userAgent || '');
}

/** Etiqueta limpia: minúsculas, solo letras/números/guion/punto, máx. 40. */
export function limpiarEtiqueta(valor: string | null | undefined): string | null {
  const v = (valor ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 40);
  return v || null;
}

/**
 * De dónde llegó la persona. Prioridad:
 *   1. La etiqueta del enlace (`?utm_source=instagram` o `?origen=qr-bolsa`):
 *      es lo que permite distinguir un QR de una bio de Instagram aunque
 *      ambos lleguen "directo" sin referrer.
 *   2. El dominio de la página anterior (google.com, instagram.com…).
 *   3. `null` = directo (escribió la dirección o abrió un enlace de
 *      WhatsApp, que no envía referrer).
 * Nunca la URL completa: podría llevar datos de más.
 */
export function origenDe(referrer: string, hostActual: string, search: string): string | null {
  const params = new URLSearchParams(search);
  const etiqueta = limpiarEtiqueta(params.get('utm_source') ?? params.get('origen'));
  if (etiqueta) return etiqueta;

  try {
    if (!referrer) return null;
    const h = new URL(referrer).hostname.replace(/^www\./, '');
    return h && h !== hostActual.replace(/^www\./, '') ? h : null;
  } catch {
    return null;
  }
}

export type FilaOrigen = { origen: string; visitas: number; personas: number };

/**
 * Agrupa visitas por origen. Una VISITA es una sesión: cinco recargas de
 * la misma sesión cuentan una. Una PERSONA es un visitor_id.
 * `null` se muestra como "Directo".
 */
export function agruparPorOrigen(filas: { session_id: string; visitor_id: string; referrer: string | null }[]): FilaOrigen[] {
  const por = new Map<string, { sesiones: Set<string>; personas: Set<string> }>();
  for (const f of filas) {
    const clave = f.referrer || 'Directo';
    const g = por.get(clave) ?? { sesiones: new Set<string>(), personas: new Set<string>() };
    g.sesiones.add(f.session_id);
    g.personas.add(f.visitor_id);
    por.set(clave, g);
  }
  return [...por.entries()]
    .map(([origen, g]) => ({ origen, visitas: g.sesiones.size, personas: g.personas.size }))
    .sort((a, b) => b.visitas - a.visitas || b.personas - a.personas || a.origen.localeCompare(b.origen));
}

/* =============================================================
 * ATRIBUCIÓN: de qué red, campaña y anuncio llegó cada persona
 *
 * Un "toque" es una llegada a la web. Se guardan dos en el navegador:
 *   · primero → por dónde llegó la persona la PRIMERA vez.
 *   · ultimo  → la última llegada que NO fue directa. Si alguien entra
 *               por un anuncio y vuelve al rato escribiendo la dirección,
 *               el pedido se le sigue acreditando al anuncio.
 * Viajan con cada evento y con el pedido (orders.origen).
 * ============================================================= */

export type Toque = { fuente: string; campana: string | null; anuncio: string | null; ts: number };
export type Toques = { primero: Toque | null; ultimo: Toque | null };

export const DIRECTO = 'directo';

/** El toque de esta llegada. `fuente` es 'directo' si no hay etiqueta ni referrer externo. */
export function toqueDe(referrer: string, hostActual: string, search: string, ahora: number): Toque {
  const params = new URLSearchParams(search);
  return {
    fuente: origenDe(referrer, hostActual, search) ?? DIRECTO,
    campana: limpiarEtiqueta(params.get('utm_campaign')),
    anuncio: limpiarEtiqueta(params.get('utm_content')),
    ts: ahora,
  };
}

/** Actualiza los toques guardados con una llegada nueva. */
export function sumarToque(previos: Toques, nuevo: Toque): Toques {
  const primero = previos.primero ?? nuevo;
  const ultimo = nuevo.fuente !== DIRECTO || !previos.ultimo ? nuevo : previos.ultimo;
  return { primero, ultimo };
}

function toqueValido(v: unknown): Toque | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const fuente = limpiarEtiqueta(typeof o.fuente === 'string' ? o.fuente : null);
  if (!fuente) return null;
  return {
    fuente,
    campana: limpiarEtiqueta(typeof o.campana === 'string' ? o.campana : null),
    anuncio: limpiarEtiqueta(typeof o.anuncio === 'string' ? o.anuncio : null),
    ts: typeof o.ts === 'number' && Number.isFinite(o.ts) ? Math.round(o.ts) : 0,
  };
}

/** Lee los toques guardados (entrada no fiable: puede estar a medias o ser de otra versión). */
export function leerToques(crudo: string | null): Toques {
  try {
    const o = crudo ? (JSON.parse(crudo) as Record<string, unknown>) : {};
    return { primero: toqueValido(o?.primero), ultimo: toqueValido(o?.ultimo) };
  } catch {
    return { primero: null, ultimo: null };
  }
}

/* ---------- "¿Cómo nos conociste?" (opcional en el carrito) ---------- */
export const OPCIONES_CONOCIO = [
  { valor: 'instagram', texto: 'Instagram' },
  { valor: 'tiktok', texto: 'TikTok' },
  { valor: 'facebook', texto: 'Facebook' },
  { valor: 'google', texto: 'Google o Maps' },
  { valor: 'amigo', texto: 'Me lo recomendaron' },
  { valor: 'local', texto: 'Pasé por el local' },
  { valor: 'otro', texto: 'Otro' },
] as const;
export type Conocio = (typeof OPCIONES_CONOCIO)[number]['valor'];
export const esConocio = (v: unknown): v is Conocio => OPCIONES_CONOCIO.some((o) => o.valor === v);
export const textoConocio = (v: string | null | undefined): string =>
  OPCIONES_CONOCIO.find((o) => o.valor === v)?.texto ?? 'Sin respuesta';

/** Versión del texto de autorización del carrito. Cambia cuando cambie el texto. */
export const VERSION_AUTORIZACION = '2026-11-25';

export type OrigenPedido = {
  primero: Toque | null;
  ultimo: Toque | null;
  conocio: Conocio | null;
  promos: boolean;
  autorizacion: string;
};

/** El origen que manda el navegador, limpio y con forma fija. Lo usa el servidor. */
export function origenDePedido(v: unknown): OrigenPedido {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return {
    primero: toqueValido(o.primero),
    ultimo: toqueValido(o.ultimo),
    conocio: esConocio(o.conocio) ? o.conocio : null,
    promos: o.promos === true,
    autorizacion: VERSION_AUTORIZACION,
  };
}

/** Nombre legible de una fuente para el panel. */
export function nombreFuente(fuente: string | null | undefined): string {
  if (!fuente) return 'Sin dato';
  const f = fuente.toLowerCase();
  if (f === DIRECTO) return 'Directo';
  if (f.includes('instagram')) return 'Instagram';
  if (f.includes('tiktok')) return 'TikTok';
  if (f.includes('facebook') || f === 'fb' || f.startsWith('meta')) return 'Meta';
  if (f.includes('google')) return 'Google';
  if (f.includes('qr')) return 'Código QR';
  return fuente;
}
