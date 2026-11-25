import { describe, expect, it } from 'vitest';
import {
  DIRECTO,
  SESION_MS,
  VERSION_AUTORIZACION,
  agruparPorOrigen,
  esBot,
  leerToques,
  limpiarEtiqueta,
  nombreFuente,
  origenDe,
  origenDePedido,
  sesionVigente,
  sumarToque,
  toqueDe,
} from './rastreo';

describe('sesionVigente', () => {
  const ahora = 1_000_000_000;
  it('sin actividad previa no hay sesión', () => {
    expect(sesionVigente(null, ahora)).toBe(false);
    expect(sesionVigente(0, ahora)).toBe(false);
  });
  it('dentro de 30 minutos sigue la misma visita', () => {
    expect(sesionVigente(ahora - 5 * 60_000, ahora)).toBe(true);
    expect(sesionVigente(ahora - SESION_MS, ahora)).toBe(true);
  });
  it('pasados 30 minutos es una visita nueva', () => {
    expect(sesionVigente(ahora - SESION_MS - 1, ahora)).toBe(false);
  });
});

describe('esBot', () => {
  it('descarta rastreadores y vistas previas', () => {
    expect(esBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(esBot('WhatsApp/2.23 A')).toBe(true);
    expect(esBot('facebookexternalhit/1.1')).toBe(true);
    expect(esBot('Chrome-Lighthouse')).toBe(true);
  });
  it('descarta automatización (webdriver)', () => {
    expect(esBot('Mozilla/5.0 Chrome/120', true)).toBe(true);
  });
  it('deja pasar navegadores reales', () => {
    expect(esBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605 Safari/604')).toBe(false);
    expect(esBot('')).toBe(false);
  });
});

describe('limpiarEtiqueta', () => {
  it('normaliza y recorta', () => {
    expect(limpiarEtiqueta('QR-Bolsa')).toBe('qr-bolsa');
    expect(limpiarEtiqueta('  instagram ')).toBe('instagram');
    expect(limpiarEtiqueta('a'.repeat(80))).toHaveLength(40);
  });
  it('quita caracteres raros (nada de scripts ni espacios)', () => {
    expect(limpiarEtiqueta('<script>x</script>')).toBe('scriptxscript');
    expect(limpiarEtiqueta('mi origen')).toBe('miorigen');
  });
  it('vacío o ausente → null', () => {
    expect(limpiarEtiqueta('')).toBeNull();
    expect(limpiarEtiqueta('!!!')).toBeNull();
    expect(limpiarEtiqueta(null)).toBeNull();
    expect(limpiarEtiqueta(undefined)).toBeNull();
  });
});

describe('origenDe', () => {
  const host = 'el-porton-cajica-9i6h.vercel.app';
  it('la etiqueta del enlace manda sobre el referrer', () => {
    expect(origenDe('https://www.google.com/', host, '?utm_source=qr-bolsa')).toBe('qr-bolsa');
    expect(origenDe('', host, '?origen=Instagram')).toBe('instagram');
  });
  it('sin etiqueta usa solo el dominio del referrer (sin www ni ruta)', () => {
    expect(origenDe('https://www.instagram.com/elportoncajica/?igsh=abc', host, '')).toBe('instagram.com');
    expect(origenDe('https://l.instagram.com/?u=https%3A%2F%2Fx', host, '')).toBe('l.instagram.com');
  });
  it('sin referrer es directo (null)', () => {
    expect(origenDe('', host, '')).toBeNull();
  });
  it('navegar dentro del propio sitio no cuenta como origen', () => {
    expect(origenDe(`https://${host}/admin`, host, '')).toBeNull();
  });
  it('un referrer inválido no rompe nada', () => {
    expect(origenDe('esto no es una url', host, '')).toBeNull();
  });
});

describe('agruparPorOrigen', () => {
  const f = (s: string, v: string, r: string | null) => ({ session_id: s, visitor_id: v, referrer: r });
  it('cuenta sesiones (visitas) y navegadores (personas) por origen', () => {
    const r = agruparPorOrigen([
      f('s1', 'p1', 'instagram'),
      f('s1', 'p1', 'instagram'), // recarga de la misma sesión: cuenta 1
      f('s2', 'p1', 'instagram'), // misma persona, otra visita
      f('s3', 'p2', 'google.com'),
      f('s4', 'p3', null),
    ]);
    expect(r).toEqual([
      { origen: 'instagram', visitas: 2, personas: 1 },
      { origen: 'Directo', visitas: 1, personas: 1 },
      { origen: 'google.com', visitas: 1, personas: 1 },
    ]);
  });
  it('lista vacía → vacío', () => {
    expect(agruparPorOrigen([])).toEqual([]);
  });
});

describe('atribución', () => {
  const host = 'www.elportoncajica.com';
  it('lee red, campaña y anuncio del enlace', () => {
    const t = toqueDe('', host, '?utm_source=meta&utm_campaign=s1-angulos&utm_content=a-antojo-v1', 5);
    expect(t).toEqual({ fuente: 'meta', campana: 's1-angulos', anuncio: 'a-antojo-v1', ts: 5 });
  });
  it('sin etiqueta ni referrer externo es directo', () => {
    expect(toqueDe('', host, '', 1).fuente).toBe(DIRECTO);
    expect(toqueDe('https://www.elportoncajica.com/', host, '', 1).fuente).toBe(DIRECTO);
  });
  it('el primero no cambia y una llegada directa no borra el último anuncio', () => {
    const anuncio = toqueDe('', host, '?utm_source=meta&utm_content=a', 1);
    const directo = toqueDe('', host, '', 2);
    const tras = sumarToque(sumarToque({ primero: null, ultimo: null }, anuncio), directo);
    expect(tras).toEqual({ primero: anuncio, ultimo: anuncio });
    const tiktok = toqueDe('https://www.tiktok.com/', host, '', 3);
    expect(sumarToque(tras, tiktok)).toEqual({ primero: anuncio, ultimo: tiktok });
  });
  it('una primera llegada directa queda como primera y última', () => {
    const d = toqueDe('', host, '', 1);
    expect(sumarToque({ primero: null, ultimo: null }, d)).toEqual({ primero: d, ultimo: d });
  });
  it('lee toques guardados rotos sin fallar', () => {
    expect(leerToques('{malo')).toEqual({ primero: null, ultimo: null });
    expect(leerToques('null')).toEqual({ primero: null, ultimo: null });
    expect(leerToques(JSON.stringify({ primero: { fuente: '<script>' } })).primero?.fuente).toBe('script');
  });
  it('el servidor limpia el origen del pedido', () => {
    const o = origenDePedido({ conocio: 'hackeo', promos: 'si', autorizacion: 'vieja', ultimo: { fuente: 'meta', ts: 1 } });
    expect(o.conocio).toBeNull();
    expect(o.promos).toBe(false);
    expect(o.autorizacion).toBe(VERSION_AUTORIZACION);
    expect(o.ultimo?.fuente).toBe('meta');
    expect(origenDePedido({ conocio: 'tiktok', promos: true })).toMatchObject({ conocio: 'tiktok', promos: true });
    expect(origenDePedido(null).primero).toBeNull();
  });
  it('nombra las fuentes', () => {
    expect(nombreFuente('instagram.com')).toBe('Instagram');
    expect(nombreFuente('meta')).toBe('Meta');
    expect(nombreFuente(DIRECTO)).toBe('Directo');
    expect(nombreFuente(null)).toBe('Sin dato');
  });
});
