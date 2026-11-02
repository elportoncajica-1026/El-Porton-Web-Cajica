/* =============================================================
 * CAMPANA DE PEDIDO NUEVO (sonido sintetizado)
 *
 * Dos toques de campana brillantes y ascendentes, al estilo del tono
 * "Nota" del iPhone. NO es el archivo de Apple (tiene derechos de
 * autor): se arma aquí con la Web Audio API, así que no hay ningún
 * archivo de sonido que descargar.
 *
 * Cada toque suma varios armónicos "inarmónicos" (como una campana de
 * verdad, no como un pito) que se apagan rápido, más los agudos que
 * los graves.
 *
 * ⚠️ Los navegadores no dejan sonar nada hasta que la persona toca la
 * página al menos una vez. Por eso existe `desbloquearSonido()`: se
 * llama con el primer toque o con el botón de sonido del panel.
 * ============================================================= */

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Clase = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Clase) return null;
    ctx = new Clase();
  }
  return ctx;
}

/** Intenta habilitar el sonido (debe llamarse desde un toque/clic). */
export async function desbloquearSonido(): Promise<boolean> {
  const c = contexto();
  if (!c) return false;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      /* el navegador lo sigue bloqueando */
    }
  }
  return c.state === 'running';
}

/** ¿El navegador ya permite sonar? */
export function sonidoDisponible(): boolean {
  return ctx?.state === 'running';
}

/* Armónicos de campana: [proporción de la frecuencia, volumen, duración relativa]. */
const ARMONICOS: [number, number, number][] = [
  [1, 1, 1],
  [2.0, 0.42, 0.7],
  [2.76, 0.26, 0.5],
  [5.4, 0.12, 0.28],
  [8.93, 0.05, 0.16],
];

function toque(c: AudioContext, salida: AudioNode, frecuencia: number, inicio: number, duracion: number) {
  for (const [proporcion, volumen, dur] of ARMONICOS) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia * proporcion;
    const fin = inicio + duracion * dur;
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.exponentialRampToValueAtTime(volumen, inicio + 0.006); // golpe
    g.gain.exponentialRampToValueAtTime(0.0001, fin); // se apaga como metal
    osc.connect(g).connect(salida);
    osc.start(inicio);
    osc.stop(fin + 0.05);
  }
}

/** Suena la campana. Si el navegador aún no deja sonar, no hace nada. */
export function tocarCampana(volumen = 0.32): void {
  const c = contexto();
  if (!c || c.state !== 'running') return;
  const master = c.createGain();
  master.gain.value = volumen;
  const compresor = c.createDynamicsCompressor(); // evita que sature en parlantes de celular
  master.connect(compresor).connect(c.destination);

  const t = c.currentTime + 0.02;
  toque(c, master, 1318.5, t, 1.0); // Mi 6
  toque(c, master, 1975.5, t + 0.13, 1.5); // Si 6
}
