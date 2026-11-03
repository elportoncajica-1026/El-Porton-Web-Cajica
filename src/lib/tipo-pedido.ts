/* =============================================================
 * TIPO DE PEDIDO: domicilio, recoger en el local o comer allá
 *
 * El cliente escoge en el carrito cómo recibe su pedido. Solo el
 * domicilio necesita dirección; los otros dos pueden indicar a qué
 * hora llegan (opcional).
 *
 * ⚠️ No hay columna nueva en la base: `customer_address` es texto
 * obligatorio, y para los pedidos sin domicilio se guarda ahí una
 * frase fija ("Recoge en el local · llega 7:30 p.m."). Así funciona
 * sin migrar la base, se lee bien en cualquier exportación, y el panel
 * reconoce el tipo por cómo empieza el texto (tipoDeDireccion).
 * ============================================================= */

export const TIPOS_PEDIDO = ['domicilio', 'recoger', 'restaurante'] as const;
export type TipoPedido = (typeof TIPOS_PEDIDO)[number];

/* `boton`: texto corto para los botones del carrito (en celular caben tres).
   `etiqueta`: nombre completo (mensaje de WhatsApp). `corta`: etiqueta del panel. */
export const TIPO_PEDIDO: Record<TipoPedido, { etiqueta: string; boton: string; corta: string; icono: string; titulo: string }> = {
  domicilio: { etiqueta: 'A domicilio', boton: 'Domicilio', corta: 'Domicilio', icono: '🛵', titulo: 'DOMICILIO' },
  recoger: { etiqueta: 'Recoger en el local', boton: 'Recoger', corta: 'Recoge', icono: '🏃', titulo: 'RECOGE EN EL LOCAL' },
  restaurante: { etiqueta: 'Comer en el restaurante', boton: 'En el restaurante', corta: 'En el restaurante', icono: '🍽️', titulo: 'COMER EN EL RESTAURANTE' },
};

/* Frases que se guardan en customer_address. No cambiarlas: el panel
   reconoce los pedidos viejos por ellas. */
const MARCA: Record<Exclude<TipoPedido, 'domicilio'>, string> = {
  recoger: 'Recoge en el local',
  restaurante: 'Come en el restaurante',
};

export const esTipoPedido = (v: unknown): v is TipoPedido =>
  typeof v === 'string' && (TIPOS_PEDIDO as readonly string[]).includes(v);

/** "19:30" → "7:30 p.m." (vacío o inválido → ''). */
export function horaLegible(hhmm: string | undefined): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  if (!m) return '';
  const h = Number(m[1]);
  const min = m[2];
  if (h > 23 || Number(min) > 59) return '';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}

/** Lo que se guarda en `customer_address` según el tipo. */
export function direccionAGuardar(tipo: TipoPedido, direccion: string, hora?: string): string {
  if (tipo === 'domicilio') return direccion;
  const llega = horaLegible(hora);
  return MARCA[tipo] + (llega ? ` · llega ${llega}` : '');
}

/** Reconoce el tipo a partir de lo guardado (todo lo demás es domicilio). */
export function tipoDeDireccion(direccion: string | null | undefined): TipoPedido {
  const d = (direccion ?? '').trim();
  if (d.startsWith(MARCA.recoger)) return 'recoger';
  if (d.startsWith(MARCA.restaurante)) return 'restaurante';
  return 'domicilio';
}
