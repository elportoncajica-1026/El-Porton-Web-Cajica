'use client';

/* =============================================================
 * BOTONES DE ESTADO DEL PEDIDO
 *
 * Reemplazan al desplegable: un toque y listo, en el orden en que avanza
 * un pedido (nuevo → en sistema → entregado). "Cancelar" va
 * aparte y con otro aspecto, para no tocarlo por accidente.
 * ============================================================= */

import { ESTADOS, ETIQUETA_ESTADO, type EstadoPedido } from '@/lib/pedidos-admin';

const FLUJO = ESTADOS.filter((e) => e !== 'cancelado');

export default function BotonesEstado({
  actual,
  deshabilitado,
  onCambiar,
}: {
  actual: EstadoPedido;
  deshabilitado?: boolean;
  onCambiar: (nuevo: EstadoPedido) => void;
}) {
  return (
    <div className="pn-estados" role="group" aria-label="Estado del pedido">
      {FLUJO.map((e) => (
        <button
          key={e}
          type="button"
          className={`pn-estado pn-estado--${e}${actual === e ? ' is-activo' : ''}`}
          aria-pressed={actual === e}
          disabled={deshabilitado}
          onClick={() => actual !== e && onCambiar(e)}
        >
          {ETIQUETA_ESTADO[e]}
        </button>
      ))}
      <button
        type="button"
        className={`pn-estado pn-estado--cancelado pn-estado--aparte${actual === 'cancelado' ? ' is-activo' : ''}`}
        aria-pressed={actual === 'cancelado'}
        disabled={deshabilitado}
        onClick={() => actual !== 'cancelado' && onCambiar('cancelado')}
      >
        Cancelado
      </button>
    </div>
  );
}
