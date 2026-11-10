/* =============================================================
 * DECORACIÓN DE TEMPORADA (Halloween)
 *
 * La página se decora sola en las fechas y se quita sola después:
 * nadie tiene que acordarse de subir nada el 1 de noviembre.
 *
 * ⚠️ La portada se genera estática, así que la fecha NO se puede
 * mirar en el servidor (quedaría la del build). Se mira en el
 * navegador con un script mínimo en el <head> que pone
 * `data-temporada="halloween"` en <html> ANTES de pintar; todo lo
 * demás es CSS (estilos-temporada.css) que solo actúa con ese atributo.
 *
 * Esta función se inyecta en ese script con `.toString()`, por eso
 * no puede usar nada de fuera: ni imports ni constantes del módulo.
 *
 * Para verla fuera de fecha: `?temporada=halloween`.
 * Para apagarla en fecha:    `?temporada=no`.
 * ============================================================= */
export function temporadaDe(fecha: Date, busqueda: string): 'halloween' | null {
  const forzada = /[?&]temporada=([a-z]+)/.exec(busqueda);
  if (forzada) return forzada[1] === 'halloween' ? 'halloween' : null;

  // Hora de Bogotá (UTC−5 todo el año, sin horario de verano).
  const b = new Date(fecha.getTime() - 5 * 3600 * 1000);
  const mes = b.getUTCMonth(); // 9 = octubre, 10 = noviembre
  const dia = b.getUTCDate();
  // Del 24 de octubre hasta el amanecer del 1 de noviembre.
  if (mes === 9 && dia >= 24) return 'halloween';
  if (mes === 10 && dia === 1 && b.getUTCHours() < 6) return 'halloween';
  return null;
}

/** El script que va en el <head>. Si algo falla, la página sale normal. */
export const SCRIPT_TEMPORADA = `try{var t=(${temporadaDe.toString()})(new Date(),location.search);if(t)document.documentElement.setAttribute('data-temporada',t)}catch(e){}`;
