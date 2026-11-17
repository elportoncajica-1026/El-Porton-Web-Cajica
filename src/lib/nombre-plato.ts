/* =============================================================
 * NOMBRE DEL PLATO CON SU CATEGORÍA
 *
 * En la carta hay nombres cortos que se repiten entre categorías y,
 * a veces, con el MISMO precio: "Tres Carnes" es una hamburguesa y
 * también una mazorcada, y las dos costaban $36.000. En el mensaje
 * de WhatsApp (y en el panel) quien prepara el pedido solo veía
 * "(1)x Tres Carnes — $36.000" y no sabía cuál era.
 *
 * Esta función antepone el tipo de plato SOLO en las tres categorías
 * cuyos nombres son ambiguos (hamburguesas, perros y mazorcadas).
 * Las demás ya se explican solas ("Pizza Familiar", "Salchipapa
 * Mixta", "Costillas BBQ", "Coca-Cola"...). Y si el nombre ya trae
 * la palabra ("Choriperro", "Mazorcada (Pollo, Res o Cerdo)"), no se
 * repite.
 * ============================================================= */

const SUSTANTIVO: Record<string, string> = {
  hamburguesas: 'Hamburguesa',
  perros: 'Perro',
  mazorcadas: 'Mazorcada',
};

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function nombreConCategoria(nombre: string, cat?: string): string {
  const sustantivo = cat ? SUSTANTIVO[cat] : undefined;
  if (!sustantivo) return nombre;
  if (normalizar(nombre).includes(normalizar(sustantivo))) return nombre;
  return `${sustantivo} ${nombre}`;
}
