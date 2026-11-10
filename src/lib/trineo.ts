/* =============================================================
 * TRAYECTORIA DEL TRINEO (Navidad)
 *
 * Funciones puras: reciben el tamaño de la pantalla y devuelven dónde
 * va el trineo en cada momento del cruce. Las usa NavidadAmbiente.tsx
 * en su bucle de animación (un solo requestAnimationFrame mueve los
 * trineos y pinta la nieve y la estela de chispas).
 *
 * El trineo no va recto: sube o baja suave mientras cruza, con una
 * ondulación larga (como si los renos tomaran impulso) y se inclina
 * siguiendo la curva, nariz arriba al subir y abajo al bajar.
 * ============================================================= */

/** Proporción del dibujo (viewBox 360 × 110). */
export const PROPORCION_TRINEO = 110 / 360;

export type RutaTrineo = {
  /** Ancho de la pantalla (px). */
  W: number;
  /** Ancho del dibujo del trineo (px). */
  ancho: number;
  /** Altura (px) de la esquina superior al entrar y al salir. */
  y0: number;
  y1: number;
  /** Cuántas ondulaciones completas hace en el cruce. */
  ondas: number;
  /** Amplitud de la ondulación (px). */
  amp: number;
  /** true = entra por la izquierda y sale por la derecha. */
  haciaDerecha: boolean;
};

export type PosTrineo = {
  /** Esquina superior izquierda del dibujo (px). */
  x: number;
  y: number;
  /** Inclinación en grados (positivo = gira en el sentido del reloj). */
  r: number;
};

const INCLINACION_MAX = 14;
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Posición en el avance `p` (0 = recién entra, totalmente fuera de cuadro;
 * 1 = ya salió por el otro lado).
 */
export function posTrineo(p: number, ruta: RutaTrineo): PosTrineo {
  const { W, ancho, y0, y1, ondas, amp, haciaDerecha } = ruta;
  const t = limitar(p, 0, 1);
  const recorrido = W + ancho * 2;
  const avance = -ancho + recorrido * t;
  const x = haciaDerecha ? avance : W - avance - ancho;

  const fase = t * Math.PI * 2 * ondas;
  const y = y0 + (y1 - y0) * t + Math.sin(fase) * amp;

  // Pendiente de la curva → inclinación. El dibujo mira a la derecha; cuando
  // va a la izquierda se refleja, y "nariz abajo" pasa a ser giro antihorario.
  const dy = y1 - y0 + Math.cos(fase) * amp * Math.PI * 2 * ondas;
  const grados = (Math.atan2(dy, recorrido) * 180) / Math.PI;
  const r = limitar(haciaDerecha ? grados : -grados, -INCLINACION_MAX, INCLINACION_MAX);
  return { x, y, r };
}

/**
 * De dónde salen las chispas: la parte de atrás del patín del trineo
 * (izquierda del dibujo si va a la derecha; derecha si va a la izquierda).
 */
export function colaTrineo(pos: PosTrineo, ancho: number, haciaDerecha: boolean): { x: number; y: number } {
  const alto = ancho * PROPORCION_TRINEO;
  return {
    x: haciaDerecha ? pos.x + ancho * 0.03 : pos.x + ancho * 0.97,
    y: pos.y + alto * 0.84,
  };
}
