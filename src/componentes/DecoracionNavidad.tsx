/* =============================================================
 * AMBIENTE DE NAVIDAD (dentro del hero)
 *
 * Siempre va en el HTML y está oculto: solo se ve cuando el script
 * de temporada pone `data-temporada="navidad"` en <html> (ver
 * lib/temporada.ts). Sin estado ni efectos de React: puro HTML + CSS.
 *
 *   - Una guirnalda de luces cuelga bajo el menú, en dos arcos. Al
 *     abrir la página los focos se encienden uno a uno (de izquierda
 *     a derecha) y después titilan despacio, cada uno a su ritmo.
 *   - Luces desenfocadas (bokeh) dorado y rojo flotan por los bordes,
 *     lejos de la comida, como las luces de un árbol fuera de foco.
 *
 * La nieve y la entrada van aparte, en <NieveNavidad/> (cliente).
 * Todo es decorativo: aria-hidden y sin clics (pointer-events: none).
 * ============================================================= */

/* Cuántos focos y cómo cuelgan. Los números son fijos (no Math.random)
   para que el servidor y el navegador pinten exactamente lo mismo. */
const FOCOS = 28;
/* Colores: dorado cálido de base, rojo cada tres, verde de vez en cuando. */
const colorDe = (i: number) => (i % 7 === 3 ? 'verde' : i % 3 === 1 ? 'rojo' : 'dorado');

/* Dos arcos (catenarias simplificadas): el cable baja en el centro de cada mitad. */
const caidaEn = (x: number) => Math.abs(Math.sin(x * Math.PI * 2)) ** 0.85;

function cablePath(ancho: number, alto: number) {
  // Muestra la curva en 60 puntos; preserveAspectRatio="none" la estira al ancho real.
  const pts: string[] = [];
  for (let k = 0; k <= 60; k++) {
    const x = k / 60;
    pts.push(`${(x * ancho).toFixed(1)},${(6 + caidaEn(x) * (alto - 14)).toFixed(1)}`);
  }
  return 'M' + pts.join(' L');
}

export default function DecoracionNavidad() {
  return (
    <div className="nv-deco" aria-hidden="true">
      <div className="nv-guirnalda">
        <svg className="nv-cable" viewBox="0 0 1000 80" preserveAspectRatio="none">
          <path d={cablePath(1000, 80)} />
        </svg>
        {Array.from({ length: FOCOS }, (_, i) => {
          const x = (i + 0.5) / FOCOS;
          const top = 6 + caidaEn(x) * 66;
          return (
            <span
              key={i}
              className={`nv-foco nv-foco--${colorDe(i)}`}
              style={{
                left: `${(x * 100).toFixed(2)}%`,
                top: `${top.toFixed(1)}%`,
                // Se encienden en orden; después cada uno titila con su propio desfase.
                ['--orden' as string]: i,
                ['--titileo' as string]: `${(2.6 + ((i * 7) % 5) * 0.45).toFixed(2)}s`,
                ['--desfase' as string]: `${(-((i * 13) % 9) * 0.37).toFixed(2)}s`,
              }}
            >
              <i className="nv-foco-luz" />
            </span>
          );
        })}
      </div>

      {/* Luces fuera de foco por los bordes: ocho, de tamaños y ritmos distintos. */}
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className={`nv-bokeh nv-bokeh--${i + 1}`} />
      ))}
    </div>
  );
}
