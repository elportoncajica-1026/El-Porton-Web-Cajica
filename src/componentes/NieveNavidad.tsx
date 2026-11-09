'use client';

/* =============================================================
 * NIEVE Y ENTRADA DE NAVIDAD
 *
 * Solo en temporada (lib/temporada.ts). Dos cosas:
 *
 *   - Entrada (≈3 s, una sola vez): la pantalla se atenúa, un destello
 *     dorado se abre desde arriba (las luces se encienden), aparece
 *     "Felices fiestas" con un barrido de luz y se desvanece. Mientras
 *     tanto la nieve entra como una ráfaga desde arriba y luego se calma.
 *   - Nieve constante: copos con profundidad (los grandes y claros van
 *     adelante y caen rápido; los pequeños y tenues atrás, despacio),
 *     con un vaivén suave y una brisa que cambia de lado.
 *
 * Es un <canvas> fijo: ~100 copos a 60 fps cuestan menos que 100
 * elementos animados, y se pausa cuando la pestaña no se ve. Nunca
 * recibe clics y va por debajo del carrito y las ventanas.
 * ============================================================= */

import { useEffect, useRef } from 'react';

type Copo = {
  x: number;
  y: number;
  r: number;        // radio en px
  vy: number;       // velocidad de caída (px/s)
  fase: number;     // del vaivén
  amp: number;      // amplitud del vaivén
  alfa: number;
};

const DURACION_ENTRADA = 3200;

export default function NieveNavidad() {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const entrada = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.temporada !== 'navidad') return;
    const canvas = lienzo.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const azar = Math.random;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    let copos: Copo[] = [];
    let raf: number | null = null;
    let anterior = 0;
    const inicio = performance.now();

    function medir() {
      W = Math.max(1, window.innerWidth);
      H = Math.max(1, window.innerHeight);
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const total = W < 768 ? 60 : 110;
      // Al arrancar todos vienen desde arriba (ráfaga de entrada); al
      // redimensionar se reparten por la pantalla para que no haya un vacío.
      const desdeArriba = copos.length === 0;
      copos = Array.from({ length: total }, () => nuevo(desdeArriba ? -azar() * H * 1.2 : azar() * H));
    }

    function nuevo(y: number): Copo {
      const prof = azar(); // 0 = lejos, 1 = cerca
      return {
        x: azar() * W,
        y,
        r: 0.8 + prof * 2.6,
        vy: 28 + prof * 62,
        fase: azar() * Math.PI * 2,
        amp: 10 + prof * 22,
        alfa: 0.28 + prof * 0.55,
      };
    }

    function cuadro(t: number) {
      raf = null;
      const dt = Math.min(0.05, anterior ? (t - anterior) / 1000 : 0.016);
      anterior = t;
      const vivido = (t - inicio) / 1000;
      // Ráfaga de entrada: cae 3 veces más rápido y se calma en 2,6 s.
      const rafaga = 1 + 2.2 * Math.max(0, 1 - vivido / 2.6) ** 2;
      // Brisa lenta que cambia de lado.
      const brisa = Math.sin(vivido * 0.21) * 14 + Math.sin(vivido * 0.047) * 10;

      ctx!.clearRect(0, 0, W, H);
      ctx!.fillStyle = '#fff';
      for (const c of copos) {
        c.y += c.vy * rafaga * dt;
        c.fase += dt * (0.9 + c.r * 0.25);
        c.x += (Math.sin(c.fase) * c.amp * 0.6 + brisa * (c.r / 3.4)) * dt;
        if (c.y > H + 6) {
          Object.assign(c, nuevo(-6 - azar() * 30));
        }
        if (c.x < -10) c.x = W + 10;
        else if (c.x > W + 10) c.x = -10;
        ctx!.globalAlpha = c.alfa;
        ctx!.beginPath();
        ctx!.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      if (!document.hidden) raf = requestAnimationFrame(cuadro);
    }

    function visibilidad() {
      if (document.hidden) {
        if (raf !== null) cancelAnimationFrame(raf);
        raf = null;
      } else if (raf === null) {
        anterior = 0;
        raf = requestAnimationFrame(cuadro);
      }
    }

    medir();
    raf = requestAnimationFrame(cuadro);
    window.addEventListener('resize', medir);
    document.addEventListener('visibilitychange', visibilidad);

    /* ---------- Entrada: velo, destello y saludo ---------- */
    const capa = entrada.current;
    const anims: Animation[] = [];
    if (capa && typeof Element.prototype.animate === 'function') {
      capa.classList.add('nv-entrada--activa');
      const suave = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
      const velo = capa.querySelector<HTMLElement>('.nv-velo');
      const destello = capa.querySelector<HTMLElement>('.nv-destello');
      const titulo = capa.querySelector<HTMLElement>('.nv-titulo');
      const barrido = capa.querySelector<HTMLElement>('.nv-barrido');
      const sub = capa.querySelector<HTMLElement>('.nv-subtitulo');
      if (velo) anims.push(velo.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
        { duration: DURACION_ENTRADA, easing: 'ease-in-out', fill: 'both' },
      ));
      if (destello) anims.push(destello.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0 },
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.95, offset: 0.22 },
          { transform: 'translate(-50%, -50%) scale(1.6)', opacity: 0.35, offset: 0.6 },
          { transform: 'translate(-50%, -50%) scale(2.1)', opacity: 0 },
        ],
        { duration: DURACION_ENTRADA, easing: suave, fill: 'both' },
      ));
      if (titulo) anims.push(titulo.animate(
        [
          { opacity: 0, transform: 'translateY(18px) scale(0.96)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)', offset: 0.3 },
          { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)', offset: 0.72 },
          { opacity: 0, transform: 'translateY(-14px) scale(1.03)', filter: 'blur(4px)' },
        ],
        { duration: DURACION_ENTRADA, easing: suave, fill: 'both' },
      ));
      if (sub) anims.push(sub.animate(
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 0, transform: 'translateY(10px)', offset: 0.32 },
          { opacity: 1, transform: 'translateY(0)', offset: 0.46 },
          { opacity: 1, transform: 'translateY(0)', offset: 0.72 },
          { opacity: 0, transform: 'translateY(-8px)' },
        ],
        { duration: DURACION_ENTRADA, easing: suave, fill: 'both' },
      ));
      if (barrido) anims.push(barrido.animate(
        [
          { transform: 'translateX(-130%) skewX(-18deg)', offset: 0 },
          { transform: 'translateX(-130%) skewX(-18deg)', offset: 0.34 },
          { transform: 'translateX(130%) skewX(-18deg)', offset: 0.66 },
          { transform: 'translateX(130%) skewX(-18deg)' },
        ],
        { duration: DURACION_ENTRADA, easing: 'ease-in-out', fill: 'both' },
      ));
      const fin = window.setTimeout(() => capa.classList.remove('nv-entrada--activa'), DURACION_ENTRADA + 50);
      anims.push({ cancel: () => window.clearTimeout(fin) } as unknown as Animation);
    }

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener('resize', medir);
      document.removeEventListener('visibilitychange', visibilidad);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <>
      <canvas ref={lienzo} className="nv-nieve" aria-hidden="true" />
      <div ref={entrada} className="nv-entrada" aria-hidden="true">
        <span className="nv-velo" />
        <span className="nv-destello" />
        <div className="nv-saludo-entrada">
          <p className="nv-titulo">
            Felices fiestas
            <span className="nv-barrido" />
          </p>
          <p className="nv-subtitulo">de parte de todo El Portón</p>
        </div>
      </div>
    </>
  );
}
