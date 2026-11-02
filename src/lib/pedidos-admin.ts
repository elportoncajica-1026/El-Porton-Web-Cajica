/* =============================================================
 * PEDIDOS EN EL PANEL — tipos y funciones puras
 * ============================================================= */

/* El orden es el del flujo real: así los botones se leen de izquierda a
   derecha en el orden en que avanza un pedido.

   2026-11 (pedido del cliente): los pedidos no se conectan con el POS,
   así que "Preparando" y "En camino" no servían. Ahora el flujo es:
   llega (Nuevo) → lo pasan al POS (En sistema) → Entregado, y Cancelado
   aparte. La columna `status` es texto libre: no hubo que tocar la base. */
export const ESTADOS = ['nuevo', 'en_sistema', 'entregado', 'cancelado'] as const;
export type EstadoPedido = (typeof ESTADOS)[number];

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  nuevo: 'Nuevo',
  en_sistema: 'En sistema',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/* Estados anteriores que aún pueden estar guardados en pedidos viejos
   (db/estados-en-sistema.sql los convierte). Si un pedido estaba
   preparándose o en camino, es que ya lo habían cargado: En sistema. */
const ESTADOS_ANTIGUOS: Record<string, EstadoPedido> = {
  preparando: 'en_sistema',
  en_camino: 'en_sistema',
};

/** Valores guardados en la base que corresponden a cada estado (para filtrar). */
export const VALORES_EN_BD: Record<EstadoPedido, string[]> = {
  nuevo: ['nuevo'],
  en_sistema: ['en_sistema', ...Object.keys(ESTADOS_ANTIGUOS)],
  entregado: ['entregado'],
  cancelado: ['cancelado'],
};

/** Lleva cualquier valor guardado al estado actual (los antiguos, a "En sistema"). */
export function estadoDe(valor: string): EstadoPedido {
  if (esEstadoValido(valor)) return valor;
  return ESTADOS_ANTIGUOS[valor] ?? 'nuevo';
}

export type LineaPedidoGuardada = {
  id?: string;
  name: string;
  cat?: string;
  qty: number;
  unitPrice?: number;
  option?: string;
  combo?: boolean;
  drink?: string | null;
  proteins?: string[];
  flavors?: string[];
  slice?: string;
  choices?: string[];
  adiciones?: { name: string; price: number }[];
  notes?: string;
};

export type Pedido = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  payment_method: string | null;
  cash_change: string | null;
  subtotal: number;
  items: LineaPedidoGuardada[];
  status: EstadoPedido;
};

export const esEstadoValido = (v: string): v is EstadoPedido =>
  (ESTADOS as readonly string[]).includes(v);

/** Resumen de una línea, tal como se lee bajo el nombre del plato. */
export function detallesDeLinea(it: LineaPedidoGuardada): string {
  const p: string[] = [];
  if (it.option && it.option !== 'Porción') p.push(it.option);
  if (it.combo) p.push('Combo' + (it.drink ? ' · ' + it.drink : ''));
  if (it.proteins?.length) p.push(it.proteins.join('+'));
  if (it.flavors?.length) p.push(it.flavors.join(', '));
  if (it.adiciones?.length) p.push('+' + it.adiciones.map((a) => a.name).join(', '));
  if (it.notes) p.push('Nota: ' + it.notes);
  return p.join(' · ');
}

/**
 * Enlace de WhatsApp al cliente. Se quedan solo los dígitos y se
 * antepone el indicativo de Colombia si no viene ya.
 *
 * ⚠️ v1 hace `'https://wa.me/57' + telefono` siempre. Si alguien
 * escribiera su número con el 57 delante, saldría "5757…" y el enlace
 * no funcionaría.
 */
export function enlaceWhatsApp(telefono: string): string {
  const digitos = (telefono || '').replace(/\D/g, '');
  if (!digitos) return '';
  const conIndicativo = digitos.startsWith('57') ? digitos : '57' + digitos;
  return `https://wa.me/${conIndicativo}`;
}

/** "17 ago, 21:35" — igual que en v1. */
export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const dinero = (n: number | null | undefined): string =>
  '$' + Number(n || 0).toLocaleString('es-CO');
