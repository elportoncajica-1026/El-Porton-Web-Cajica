/* =============================================================
 * AMBIENTE DE NAVIDAD (dentro del hero)
 *
 * Siempre va en el HTML y está oculto: solo se ve cuando el script de
 * temporada pone `data-temporada="navidad"` en <html> (ver
 * lib/temporada.ts). Sin estado ni efectos de React: HTML + CSS.
 *
 *   - Luz de noche fría: viñeta azul oscura y un resplandor de luna arriba.
 *   - Escarcha en las esquinas de arriba.
 *   - Cuatro copos de cristal grandes que flotan y giran despacio por los
 *     bordes, lejos de la comida.
 *   - Un banco de nieve al pie del hero, más alto en las orillas y bajo en
 *     el centro (para no tapar el "Desliza"), con destellos que titilan.
 *
 * La nieve que cae, los trineos y la entrada van en <NavidadAmbiente/>.
 * Todo es decorativo: aria-hidden y sin clics (pointer-events: none).
 * ============================================================= */

/** Copo de nieve de seis brazos con ramitas, en un cuadro de 100 × 100. */
function Cristal({ className }: { className: string }) {
  const brazo = 'M50 50 L50 7 M50 20 L42 12 M50 20 L58 12 M50 32 L43 25 M50 32 L57 25 M50 43 L45 39 M50 43 L55 39';
  return (
    <svg className={`nv-cristal ${className}`} viewBox="0 0 100 100" focusable="false">
      {[0, 60, 120, 180, 240, 300].map((g) => (
        <path key={g} d={brazo} transform={`rotate(${g} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="3.2" />
    </svg>
  );
}

/* Destellos sobre el banco de nieve: posición fija (igual en servidor y navegador). */
const DESTELLOS = [
  { left: '6%', bottom: '38%', d: '0s' },
  { left: '14%', bottom: '30%', d: '1.3s' },
  { left: '23%', bottom: '22%', d: '2.1s' },
  { left: '71%', bottom: '24%', d: '0.7s' },
  { left: '82%', bottom: '34%', d: '1.8s' },
  { left: '93%', bottom: '44%', d: '2.6s' },
];

export default function DecoracionNavidad() {
  return (
    <div className="nv-deco" aria-hidden="true">
      <span className="nv-escarcha nv-escarcha--izq" />
      <span className="nv-escarcha nv-escarcha--der" />

      <Cristal className="nv-cristal--1" />
      <Cristal className="nv-cristal--2" />
      <Cristal className="nv-cristal--3" />
      <Cristal className="nv-cristal--4" />

      <div className="nv-banco">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id="nv-banco-luz" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#cfe6ff" />
            </linearGradient>
          </defs>
          {/* Atrás, más tenue: da volumen. */}
          <path
            className="nv-banco-atras"
            d="M0 120 L0 26 C140 8 250 44 400 40 C560 36 640 70 760 76 C880 82 980 52 1120 44 C1260 36 1350 10 1440 18 L1440 120 Z"
          />
          <path
            fill="url(#nv-banco-luz)"
            d="M0 120 L0 44 C120 24 220 58 360 54 C520 48 600 84 720 92 C840 98 920 66 1080 58 C1220 50 1320 24 1440 34 L1440 120 Z"
          />
        </svg>
        {DESTELLOS.map((s, i) => (
          <i key={i} className="nv-destello" style={{ left: s.left, bottom: s.bottom, animationDelay: s.d }} />
        ))}
      </div>
    </div>
  );
}
