/* =============================================================
 * EQUIVALENCIAS VectorPOS → CARTA WEB
 *
 * Se cruza por el CÓDIGO del POS (columna "Codigo" de la plantilla), no
 * por el nombre: el código no cambia aunque alguien renombre el producto.
 *
 * Tipos:
 *   · producto → fija el precio de una opción de un plato de la web.
 *       `arrastrar: true` = las OTRAS opciones de ese plato se mueven en la
 *       misma cantidad. Ej.: el POS solo tiene el precio con carne Koller;
 *       si sube $1.000, Pollo y Artesanal también suben $1.000 (se conserva
 *       la diferencia que había).
 *   · combo / adicion → viven en el CÓDIGO (data/menu.ts), no en la base.
 *       Se muestran como aviso si cambiaron, pero no se aplican solos.
 *
 * Los productos del POS que no están aquí (entradas, masas,
 * icopor…) no existen en la carta web y se ignoran.
 *
 * Tabla armada a partir de Plantilla_Productos.xlsx (2026-10).
 * ============================================================= */

export type MapeoPos =
  | { tipo: 'producto'; id: string; opcion: string; arrastrar?: boolean }
  | { tipo: 'combo' }
  | { tipo: 'adicion'; nombre: string };

const H = (id: string, opcion = 'Koller'): MapeoPos => ({ tipo: 'producto', id, opcion, arrastrar: true });
const S = (id: string): MapeoPos => ({ tipo: 'producto', id, opcion: 'Estándar', arrastrar: true });
const P = (id: string, opcion = 'Porción'): MapeoPos => ({ tipo: 'producto', id, opcion });
const A = (nombre: string): MapeoPos => ({ tipo: 'adicion', nombre });

export const MAPEO_POS: Record<string, MapeoPos> = {
  // ---- Hamburguesas: el POS trae el precio con Koller ----
  '112700002': H('h-sencilla'),
  '112700003': H('h-sencilla-doble'),
  '112700001': H('h-clasica'),
  '112700004': H('h-clasica-doble'),
  '112700005': H('h-mixta'),
  '112700010': H('h-mexicana'),
  '112700011': H('h-cheese-bacon'),
  '112700006': H('h-campesina'),
  '112700007': H('h-ranchera'),
  '112700008': H('h-hawaiana'),
  '112700009': H('h-callejera'),
  '112700014': H('h-montanera'),
  '112700012': H('h-golosa'),
  '112700013': P('h-tres-carnes', 'Artesanal'),

  // ---- Perros ----
  '112600002': P('p-clasico'),
  '112600003': P('p-choriperro'),
  '112600004': P('p-tocineta'),
  '112600005': P('p-mexicano'),
  '112600006': P('p-hawaiano'),
  '112600007': P('p-callejero'),
  '112600010': P('p-todo-terreno'),
  '112600008': P('p-gloton'),

  // ---- Mazorcadas: media y completa son opciones del mismo plato ----
  '111500003': P('m-carne', '1/2 Porción'),
  '111500008': P('m-carne', 'Completa'),
  '111500005': P('m-mixta', 'Completa'),
  '111500010': P('m-vegetariana'),
  '111500009': P('m-ranchera'),
  '111500007': P('m-colombiana'),
  '111500006': P('m-tres-carnes'),

  // ---- Salchipapas: el POS trae la Estándar; "Con Codorniz" se arrastra ----
  '117400001': S('s-choripapa'),
  '117400003': S('s-clasica'),
  '117400005': S('s-doble'),
  '117400007': S('s-salchipollo'),
  '117400019': S('s-mixta'),
  '117400009': S('s-salchicosta'),
  '117400011': S('s-cheese-bacon'),

  // ---- Carnes (agregadas a la carta web el 2026-11-05) ----
  '112100005': P('c-pechuga-gratinada'),
  '112100006': P('c-pechuga-porton'),
  '112100007': P('c-carne-plancha'),
  '112100008': P('c-costillas-bbq'),

  // ---- Pizzas y lasañas ----
  '119100016': P('pz-personal', 'Personal'),
  '119100017': P('pz-mediana', 'Mediana'),
  '119100018': P('pz-familiar', 'Familiar'),
  '115100001': P('l-pollo'),
  '115100002': P('l-carne'),
  '115100003': P('l-mixta'),

  // ---- Menú infantil ----
  '112300001': P('i-hamburguesa'),
  '112300002': P('i-perro'),

  // ---- Bebidas ----
  '122100031': P('b-gaseosa', '350ml'),
  '122100029': P('b-gaseosa', '400ml'),
  '122100030': P('b-gaseosa', '500ml'),
  '122100034': P('b-gaseosa', 'Lata'),
  '122100024': P('b-gaseosa', '1.5 Lt'),
  '122100035': P('b-bretana'),
  '122100028': P('b-agua'),
  '122100023': P('b-fuze-te'),
  '122100011': P('b-pony-malta'),
  '122100025': P('b-jugo-valle'),
  '122100033': P('b-te-hatsu'),
  '122100032': P('b-soda-hatsu'),
  '122100038': P('b-limonada'),
  '122100037': P('b-zumo-limon'),
  '122100026': P('b-cola-pola'),

  // ---- Cervezas (Águila normal y light son un solo producto en la web) ----
  '213100001': P('b-poker'),
  '213100002': P('b-aguila'),
  '213100003': P('b-aguila'),
  '213100004': P('b-club-colombia'),
  '213100005': P('b-corona'),
  '213100006': P('b-coronita'),

  // ---- En el código: solo aviso ----
  '311100003': { tipo: 'combo' },
  '311100004': { tipo: 'combo' },
  '114400001': A('Huevos de codorniz (10 u)'),
  '112100009': A('Carne Koller'),
  '112100002': A('Carne Artesanal 200gr'),
  '112100003': A('Pollo Apanado'),
  '112100010': A('Res / Cerdo / Pollo 150gr'),
  '112100011': A('Res / Cerdo / Pollo 150gr'),
  '112100012': A('Res / Cerdo / Pollo 150gr'),
  '112100014': A('Tocineta'),
  '112600011': A('Chorizo'),
  '112600012': A('Salchicha Americana'),
  '114300001': A('Queso tajado (2 lonjas)'),
  '114300003': A('Queso Costeño 60gr'),
  '114300002': A('Queso Rallado Doble Crema'),
  '114400002': A('Huevo frito'),
  '111500011': A('Maíz'),
  '117100003': A('Champiñón Salteado'),
  '111100005': A('Papa cabello de ángel'),
  '114300007': A('Cheddar 100gr'),
};
