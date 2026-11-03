'use client';

/* =============================================================
 * SECCIÓN "TIEMPOS" DEL PANEL
 *
 * Edita cuánto tarda cada tipo de pedido; es lo que el carrito le
 * dice al cliente ("Tu domicilio llega en 40 a 50 minutos aprox.").
 * Se guarda en la tabla `ajustes` (clave "tiempos") y la página lo
 * toma en menos de un minuto (lib/tiempos-servidor.ts).
 *
 * Si la tabla todavía no existe, lo dice claro y cómo crearla, en vez
 * de fallar en silencio: el carrito mientras tanto usa los de por defecto.
 * ============================================================= */

import { useEffect, useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase-navegador';
import { TIPO_PEDIDO, TIPOS_PEDIDO, type TipoPedido } from '@/lib/tipo-pedido';
import { TIEMPOS_POR_DEFECTO, erroresTiempos, esExacto, normalizarTiempos, textoAviso, MINUTOS_MAX, MINUTOS_MIN, type Tiempos as TiemposT } from '@/lib/tiempos';

type Borrador = Record<TipoPedido, { min: string; max: string }>;
/** "rango" = de X a Y minutos · "exacto" = un solo número (se guarda con mínimo = máximo). */
type Modo = 'rango' | 'exacto';
type Modos = Record<TipoPedido, Modo>;

const aBorrador = (t: TiemposT): Borrador =>
  Object.fromEntries(TIPOS_PEDIDO.map((k) => [k, { min: String(t[k].min), max: String(t[k].max) }])) as Borrador;

const aModos = (t: TiemposT): Modos =>
  Object.fromEntries(TIPOS_PEDIDO.map((k) => [k, esExacto(t[k]) ? 'exacto' : 'rango'])) as Modos;

export default function Tiempos({ recargarToken }: { recargarToken: number }) {
  const sb = supabaseNavegador();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [modos, setModos] = useState<Modos>(() => aModos(TIEMPOS_POR_DEFECTO));
  const [falta, setFalta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const { data, error } = await sb.from('ajustes').select('valor').eq('clave', 'tiempos').maybeSingle();
      if (!vigente) return;
      // Tabla inexistente: el código de Postgres es 42P01 (o PostgREST avisa que no está en el esquema).
      const noExiste = !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message));
      setFalta(noExiste);
      const t = normalizarTiempos(error ? null : data?.valor);
      setBorrador(aBorrador(t));
      setModos(aModos(t));
    })();
    return () => {
      vigente = false;
    };
  }, [sb, recargarToken]);

  if (!borrador) return <p className="loading">Cargando tiempos…</p>;

  const errores = erroresTiempos(borrador);

  function cambiar(tipo: TipoPedido, campo: 'min' | 'max' | 'ambos', valor: string) {
    setMensaje(null);
    const v = valor.replace(/\D/g, '').slice(0, 3);
    const nuevo = campo === 'ambos' ? { min: v, max: v } : { [campo]: v };
    setBorrador((b) => (b ? { ...b, [tipo]: { ...b[tipo], ...nuevo } } : b));
  }

  /** Al pasar a "Exacto" se queda con el máximo; al volver a "Rango", el mínimo baja 5 minutos. */
  function cambiarModo(tipo: TipoPedido, modo: Modo) {
    if (!borrador || modos[tipo] === modo) return;
    setMensaje(null);
    setModos((m) => ({ ...m, [tipo]: modo }));
    const { min, max } = borrador[tipo];
    if (modo === 'exacto') cambiar(tipo, 'ambos', max);
    else if (min === max && Number(max) > MINUTOS_MIN) {
      setBorrador((b) => (b ? { ...b, [tipo]: { min: String(Math.max(MINUTOS_MIN, Number(max) - 5)), max } } : b));
    }
  }

  async function guardar() {
    if (!borrador || errores.length) return;
    setGuardando(true);
    setMensaje(null);
    const valor = normalizarTiempos(borrador);
    const { error } = await sb.from('ajustes').upsert({ clave: 'tiempos', valor, updated_at: new Date().toISOString() });
    setGuardando(false);
    if (error) {
      setMensaje({ ok: false, texto: 'No se pudo guardar: ' + error.message });
      return;
    }
    setFalta(false);
    setMensaje({ ok: true, texto: 'Guardado. En la página se ve en menos de un minuto.' });
  }

  return (
    <div className="panel-box">
      <h3>Tiempos de entrega</h3>
      <p className="tp-intro">Lo que el carrito le dice al cliente según cómo pida. Elige un rango (de 40 a 50 min) o un tiempo exacto (40 min).</p>

      {falta && (
        <p className="login-error">
          Falta crear la tabla de ajustes en Supabase: corre <b>db/ajustes-setup.sql</b> en el SQL Editor. Mientras tanto
          el carrito muestra los tiempos por defecto (domicilio 40–50 min, recoger y restaurante 15–20 min).
        </p>
      )}

      <div className="tp-lista">
        {TIPOS_PEDIDO.map((tipo) => {
          const r = borrador[tipo];
          const valido = erroresTiempos({ ...TIEMPOS_POR_DEFECTO, [tipo]: r }).length === 0;
          return (
            <div className="tp-fila" key={tipo}>
              <div className="tp-tipo">
                <span aria-hidden="true">{TIPO_PEDIDO[tipo].icono}</span> {TIPO_PEDIDO[tipo].etiqueta}
              </div>
              <div className="tp-campos">
                <div className="tp-modo" role="group" aria-label={`${TIPO_PEDIDO[tipo].etiqueta}: tipo de tiempo`}>
                  {(['rango', 'exacto'] as const).map((m) => (
                    <button key={m} type="button" className={modos[tipo] === m ? 'is-on' : ''} aria-pressed={modos[tipo] === m} onClick={() => cambiarModo(tipo, m)}>
                      {m === 'rango' ? 'Rango' : 'Exacto'}
                    </button>
                  ))}
                </div>
                {modos[tipo] === 'exacto' ? (
                  <label>
                    <span>En</span>
                    <input inputMode="numeric" value={r.max} onChange={(e) => cambiar(tipo, 'ambos', e.target.value)} aria-label={`${TIPO_PEDIDO[tipo].etiqueta}: minutos`} />
                  </label>
                ) : (
                  <>
                    <label>
                      <span>De</span>
                      <input inputMode="numeric" value={r.min} onChange={(e) => cambiar(tipo, 'min', e.target.value)} aria-label={`${TIPO_PEDIDO[tipo].etiqueta}: mínimo de minutos`} />
                    </label>
                    <label>
                      <span>a</span>
                      <input inputMode="numeric" value={r.max} onChange={(e) => cambiar(tipo, 'max', e.target.value)} aria-label={`${TIPO_PEDIDO[tipo].etiqueta}: máximo de minutos`} />
                    </label>
                  </>
                )}
                <span className="tp-min">min</span>
              </div>
              <p className="tp-vista">
                {valido ? (
                  <>⏱️ {Object.values(textoAviso(tipo, { min: Number(r.min), max: Number(r.max) })).join('')}</>
                ) : (
                  <span className="tp-mal">Revisa los minutos ({MINUTOS_MIN} a {MINUTOS_MAX}, el primero menor o igual).</span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {errores.length > 0 && <p className="login-error">{errores.join(' ')}</p>}
      {mensaje && <p className={mensaje.ok ? 'tp-ok' : 'login-error'}>{mensaje.texto}</p>}

      <div className="tp-acciones">
        <button type="button" className="btn-ghost" onClick={() => { setBorrador(aBorrador(TIEMPOS_POR_DEFECTO)); setModos(aModos(TIEMPOS_POR_DEFECTO)); setMensaje(null); }}>
          Volver a los de por defecto
        </button>
        <button type="button" className="btn-primary" disabled={guardando || errores.length > 0} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar tiempos'}
        </button>
      </div>
    </div>
  );
}
