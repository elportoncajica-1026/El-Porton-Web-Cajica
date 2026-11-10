'use client';

/* =============================================================
 * NAVIDAD: NIEVE, TRINEOS Y ENTRADA "¡LLEGÓ LA NAVIDAD!"
 *
 * Solo en temporada (lib/temporada.ts). Tres cosas:
 *
 *   - Entrada (≈4,4 s, al abrir la página): la pantalla se vuelve noche
 *     azul, el trineo de Santa cruza con sus renos dejando una estela de
 *     chispas, y la estela va escribiendo "¡Llegó la Navidad!". Luego
 *     todo se desvanece y queda la página nevando.
 *   - Nieve constante con profundidad: los copos de adelante son grandes,
 *     rápidos y con forma de cristal (seis puntas que giran); los de atrás,
 *     puntos pequeños y lentos. Vaivén suave y una brisa que cambia de lado.
 *   - Cada 14–26 s un trineo cruza la pantalla a lo lejos, de un lado a
 *     otro, con su estela.
 *
 * Un solo requestAnimationFrame mueve todo: pinta la nieve y las chispas
 * en <canvas> y mueve los trineos (un dibujo SVG) con transform. Se pausa
 * cuando la pestaña no se ve. Nada recibe clics; la entrada pasa sobre
 * el menú pero debajo del carrito y las ventanas.
 * ============================================================= */

import { useEffect, useRef } from 'react';
import { colaTrineo, posTrineo, type RutaTrineo } from '@/lib/trineo';

/* ---------- El dibujo: trineo con Santa y cuatro renos (mira a la derecha) ---------- */
function reno(tx: number, ty: number, i: number, guia: boolean) {
  return `<g transform="translate(${tx} ${ty})"><g class="tr-reno" style="--paso:${(-i * 0.11).toFixed(2)}s">
<g class="tr-pata tr-pata--del"><path d="M11 3 L19 9 L27 7 M9 4 L15 12 L21 15"/></g>
<g class="tr-pata tr-pata--tra"><path d="M-11 3 L-21 8 L-29 6 M-13 4 L-20 12 L-27 15"/></g>
<path class="tr-cuerpo" d="M-17 -1 C-17 -6 -10 -8 0 -8 C8 -8 12 -6 14 -4 C16 -9 18 -13 20 -17 L26 -15 C24 -10 20 -3 15 3 C11 7 4 8 -2 8 C-10 8 -17 5 -17 -1 Z"/>
<ellipse class="tr-cuerpo" cx="27" cy="-17" rx="6.4" ry="3.6" transform="rotate(-12 27 -17)"/>
<path class="tr-cuerpo" d="M23 -20 L20 -24.5 L25.5 -21 Z M-17 -2 L-21.5 -5.5 L-18 1 Z"/>
<path class="tr-cuerno" d="M24 -20 C23 -26 20 -30 15 -32 M20.5 -27.5 C18 -27.5 16 -25.5 15 -23 M18.5 -30.5 C17 -33 17 -36 18 -38.5 M26 -20 C27 -26 25.5 -31 22.5 -35.5 M25.6 -27 C28 -29 30 -30 32.5 -30"/>
${guia ? '<circle class="tr-nariz" cx="33.6" cy="-16.6" r="1.9"/>' : ''}
</g></g>`;
}

const SVG_TRINEO = `<svg viewBox="0 0 360 110" focusable="false">
<path class="tr-rienda" d="M82 37 C110 46 134 58 160 60 L215 52 L270 44 L325 36"/>
<path class="tr-saco" d="M11 44 C7 31 15 20 24 24 C31 17 42 25 37 44 Z"/>
<path class="tr-saco-nudo" d="M20 23.5 L29 21.5"/>
<path class="tr-santa-traje" d="M40 60 C40 46 48 36 58 36 C68 36 74 46 74 60 Z"/>
<path class="tr-santa-brazo" d="M68 45 L82 37"/>
<circle class="tr-santa-cara" cx="60" cy="29" r="6.6"/>
<path class="tr-santa-barba" d="M53.6 30 C54.4 39 65.6 39 66.4 30 C63 32.6 57 32.6 53.6 30 Z"/>
<path class="tr-santa-gorro" d="M53.4 25.6 C55 15 64 9 73.6 15 L67.6 22.6 C63 21 57.6 22.4 53.4 25.6 Z"/>
<path class="tr-santa-borde" d="M53 26 C57.6 22.6 63 21.4 67.8 22.8"/>
<circle class="tr-santa-pompon" cx="74.4" cy="14.6" r="2.7"/>
<path class="tr-caja" d="M6 84 L6 54 C6 44 12 40 20 42 C25 43 27 48 27 54 L27 60 L84 60 C96 60 102 52 104 42 C105 35 112 34 112 42 C111 64 101 84 84 84 Z"/>
<path class="tr-caja-filete" d="M11 76 L92 76 M98 66 C105 60 107 51 105 45"/>
<path class="tr-patin" d="M4 96 C10 101 20 101 30 101 L98 101 C110 101 117 95 115 86 M28 101 L33 83 M88 101 L84 83"/>
${reno(150, 60, 0, false)}${reno(205, 52, 1, false)}${reno(260, 44, 2, false)}${reno(315, 36, 3, true)}
</svg>`;

/* ---------- Tipos del bucle ---------- */
type Copo = {
  x: number;
  y: number;
  r: number;        // radio en px
  vy: number;       // caída (px/s)
  fase: number;     // vaivén
  amp: number;
  alfa: number;
  cristal: boolean; // los de adelante se dibujan como copo de seis puntas
  giro: number;
  vgiro: number;
};

type Chispa = { x: number; y: number; vx: number; vy: number; vida: number; max: number; r: number; estrella: boolean; brillo: number };

type Trineo = {
  el: HTMLElement;
  ruta: RutaTrineo;
  inicio: number;
  dur: number;
  chispas: Chispa[];
  ritmo: number;   // chispas por segundo
  resto: number;   // fracción de chispa pendiente
};

const DUR_ENTRADA = 4400;
const VIAJE_ENTRADA = { desde: 280, dura: 2700 };

export default function NavidadAmbiente() {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const cielo = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLDivElement>(null);
  const lienzoEntrada = useRef<HTMLCanvasElement>(null);
  const titulo = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.temporada !== 'navidad') return;
    const canvas = lienzo.current;
    const ctx = canvas?.getContext('2d');
    const capaCielo = cielo.current;
    if (!canvas || !ctx || !capaCielo) return;

    const azar = Math.random;
    const entre = (a: number, b: number) => a + (b - a) * azar();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    let copos: Copo[] = [];
    let raf: number | null = null;
    let anterior = 0;
    let activo = true;
    const inicio = performance.now();
    const relojes: number[] = [];
    const animaciones: Animation[] = [];

    const chispasCielo: Chispa[] = [];
    const chispasEntrada: Chispa[] = [];
    const trineos: Trineo[] = [];

    /* ---------- tamaño ---------- */
    const capaEntrada = entrada.current;
    const canvasE = lienzoEntrada.current;
    const ctxE = canvasE?.getContext('2d') ?? null;

    function ajustar(c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      c.width = W * dpr;
      c.height = H * dpr;
      c.style.width = `${W}px`;
      c.style.height = `${H}px`;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function medir() {
      W = Math.max(1, window.innerWidth);
      H = Math.max(1, window.innerHeight);
      ajustar(canvas!, ctx!);
      if (canvasE && ctxE) ajustar(canvasE, ctxE);
      const total = W < 768 ? 70 : 130;
      // Al arrancar todos vienen desde arriba (ráfaga de entrada); al
      // redimensionar se reparten por la pantalla para que no quede un vacío.
      const desdeArriba = copos.length === 0;
      copos = Array.from({ length: total }, () => nuevoCopo(desdeArriba ? -azar() * H * 1.2 : azar() * H));
    }

    function nuevoCopo(y: number): Copo {
      const prof = azar(); // 0 = lejos, 1 = cerca
      return {
        x: azar() * W,
        y,
        r: 0.7 + prof * 2.7,
        vy: 26 + prof * 64,
        fase: azar() * Math.PI * 2,
        amp: 10 + prof * 24,
        alfa: 0.3 + prof * 0.6,
        cristal: prof > 0.8,
        giro: azar() * Math.PI,
        vgiro: (azar() - 0.5) * 1.6,
      };
    }

    /* ---------- chispas de la estela ---------- */
    function soltarChispas(tr: Trineo, x: number, y: number, dt: number) {
      tr.resto += tr.ritmo * dt;
      const dir = tr.ruta.haciaDerecha ? 1 : -1;
      while (tr.resto >= 1) {
        tr.resto -= 1;
        const max = entre(0.8, 1.7);
        tr.chispas.push({
          x: x + entre(-6, 6),
          y: y + entre(-4, 4),
          vx: -dir * entre(15, 70),
          vy: entre(-10, 35),
          vida: max,
          max,
          r: entre(0.7, 2),
          estrella: azar() < 0.18,
          brillo: azar() * 10,
        });
      }
    }

    function pintarChispas(cx: CanvasRenderingContext2D, lista: Chispa[], dt: number, t: number) {
      for (let i = lista.length - 1; i >= 0; i--) {
        const c = lista[i];
        c.vida -= dt;
        if (c.vida <= 0) {
          lista.splice(i, 1);
          continue;
        }
        c.vy += 26 * dt; // cae despacio, como polvo de estrellas
        c.vx *= 0.985;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        const a = (c.vida / c.max) * (0.65 + 0.35 * Math.sin(t * 0.02 + c.brillo));
        cx.globalAlpha = a * 0.22;
        cx.fillStyle = '#9fd3ff';
        cx.beginPath();
        cx.arc(c.x, c.y, c.r * 3.4, 0, Math.PI * 2);
        cx.fill();
        cx.globalAlpha = a;
        cx.fillStyle = '#ffffff';
        cx.beginPath();
        cx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        cx.fill();
        if (c.estrella) {
          const l = c.r * 4.2;
          cx.globalAlpha = a * 0.85;
          cx.strokeStyle = '#ffffff';
          cx.lineWidth = 1;
          cx.beginPath();
          cx.moveTo(c.x - l, c.y);
          cx.lineTo(c.x + l, c.y);
          cx.moveTo(c.x, c.y - l);
          cx.lineTo(c.x, c.y + l);
          cx.stroke();
        }
      }
      cx.globalAlpha = 1;
    }

    /* ---------- trineos ---------- */
    function crearTrineo(capa: HTMLElement, ancho: number, clase: string) {
      const el = document.createElement('div');
      el.className = `nv-trineo ${clase}`;
      el.style.width = `${ancho}px`;
      el.innerHTML = SVG_TRINEO;
      el.style.transform = 'translate3d(-9999px, 0, 0)';
      capa.appendChild(el);
      return el;
    }

    function moverTrineo(tr: Trineo, t: number, dt: number) {
      const p = (t - tr.inicio) / tr.dur;
      if (p < 0) return false;
      const pos = posTrineo(p, tr.ruta);
      const espejo = tr.ruta.haciaDerecha ? 1 : -1;
      tr.el.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) rotate(${pos.r.toFixed(2)}deg) scaleX(${espejo})`;
      if (p < 1) {
        const cola = colaTrineo(pos, tr.ruta.ancho, tr.ruta.haciaDerecha);
        soltarChispas(tr, cola.x, cola.y, dt);
      }
      return p >= 1;
    }

    /* Trineo de ambiente: a lo lejos, más pequeño, por la franja de arriba. */
    function cruce() {
      if (!activo) return;
      const ocupado = trineos.some((tr) => tr.chispas === chispasCielo);
      if (!document.hidden && !ocupado) {
        const movil = W < 768;
        const ancho = movil ? 150 : Math.min(260, Math.max(190, W * 0.17));
        const techo = 170; // siempre por debajo del menú
        const y0 = entre(techo, Math.max(techo + 40, H * 0.42));
        const y1 = Math.max(techo, y0 + entre(-H * 0.12, H * 0.08));
        trineos.push({
          el: crearTrineo(capaCielo!, ancho, 'nv-trineo--lejos'),
          ruta: { W, ancho, y0, y1, ondas: entre(1, 2), amp: entre(12, 26), haciaDerecha: azar() < 0.5 },
          inicio: performance.now(),
          dur: movil ? 7500 : entre(10000, 13000),
          chispas: chispasCielo,
          ritmo: 45,
          resto: 0,
        });
      }
      relojes.push(window.setTimeout(cruce, entre(14000, 26000)));
    }

    /* ---------- entrada ---------- */
    let trineoEntrada: Trineo | null = null;
    if (capaEntrada && canvasE && ctxE && typeof Element.prototype.animate === 'function') {
      capaEntrada.classList.add('nv-entrada--activa');
      animaciones.push(
        capaEntrada.animate(
          [{ opacity: 0 }, { opacity: 1, offset: 0.07 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
          { duration: DUR_ENTRADA, easing: 'ease-in-out', fill: 'both' },
        ),
      );
      const sub = capaEntrada.querySelector<HTMLElement>('.nv-llego-sub');
      if (sub) {
        animaciones.push(
          sub.animate(
            [
              { opacity: 0, transform: 'translateY(10px)' },
              { opacity: 0, transform: 'translateY(10px)', offset: 0.52 },
              { opacity: 1, transform: 'translateY(0)', offset: 0.62 },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            { duration: DUR_ENTRADA, easing: 'ease-out', fill: 'both' },
          ),
        );
      }
      if (titulo.current) {
        // Un pequeño latido de luz cuando la frase queda completa.
        animaciones.push(
          titulo.current.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.045)', offset: 0.4 }, { transform: 'scale(1)' }],
            { duration: 700, delay: 2350, easing: 'ease-out', fill: 'none' },
          ),
        );
      }
    }

    function arrancarEntrada() {
      if (!capaEntrada || !canvasE || !ctxE || trineoEntrada) return;
      const ancho = Math.min(W * 0.78, 600);
      trineoEntrada = {
        el: crearTrineo(capaEntrada, ancho, 'nv-trineo--entrada'),
        ruta: { W, ancho, y0: H * 0.5, y1: H * 0.05, ondas: 1, amp: H * 0.025, haciaDerecha: true },
        inicio: inicio + VIAJE_ENTRADA.desde,
        dur: VIAJE_ENTRADA.dura,
        chispas: chispasEntrada,
        ritmo: 110,
        resto: 0,
      };
    }

    /* La estela "escribe" la frase: se descubre a medida que pasa la cola del trineo. */
    function revelarTitulo(dt: number) {
      const tit = titulo.current;
      if (!tit || !trineoEntrada) return;
      const caja = tit.getBoundingClientRect();
      const p = (performance.now() - trineoEntrada.inicio) / trineoEntrada.dur;
      const pos = posTrineo(p, trineoEntrada.ruta);
      const cola = colaTrineo(pos, trineoEntrada.ruta.ancho, true);
      const avance = p >= 1 ? 1 : Math.min(1, Math.max(0, (cola.x - caja.left) / Math.max(1, caja.width)));
      tit.style.clipPath = `inset(-30% ${((1 - avance) * 100).toFixed(2)}% -30% -8%)`;
      // Chispas en el borde donde se va escribiendo.
      if (avance > 0 && avance < 1) {
        const n = Math.round(60 * dt) + (azar() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const max = entre(0.5, 1.1);
          chispasEntrada.push({
            x: caja.left + caja.width * avance + entre(-4, 4),
            y: caja.top + entre(0.1, 0.9) * caja.height,
            vx: entre(-30, 30),
            vy: entre(-40, 10),
            vida: max,
            max,
            r: entre(0.6, 1.6),
            estrella: azar() < 0.25,
            brillo: azar() * 10,
          });
        }
      }
    }

    /* ---------- el bucle ---------- */
    function cuadro(t: number) {
      raf = null;
      const dt = Math.min(0.05, anterior ? (t - anterior) / 1000 : 0.016);
      anterior = t;
      const vivido = (t - inicio) / 1000;
      // Ráfaga de entrada: la nieve cae 3 veces más rápido y se calma en 2,8 s.
      const rafaga = 1 + 2.2 * Math.max(0, 1 - vivido / 2.8) ** 2;
      const brisa = Math.sin(vivido * 0.21) * 14 + Math.sin(vivido * 0.047) * 10;

      ctx!.clearRect(0, 0, W, H);
      ctx!.fillStyle = '#f4faff';
      ctx!.strokeStyle = '#f4faff';
      ctx!.lineCap = 'round';
      for (const c of copos) {
        c.y += c.vy * rafaga * dt;
        c.fase += dt * (0.9 + c.r * 0.25);
        c.giro += c.vgiro * dt;
        c.x += (Math.sin(c.fase) * c.amp * 0.6 + brisa * (c.r / 3.4)) * dt;
        if (c.y > H + 10) Object.assign(c, nuevoCopo(-10 - azar() * 40));
        if (c.x < -12) c.x = W + 12;
        else if (c.x > W + 12) c.x = -12;
        ctx!.globalAlpha = c.alfa;
        if (c.cristal) {
          // Copo de seis puntas: tres trazos que se cruzan, con ramitas.
          const l = c.r * 2.5;
          ctx!.lineWidth = Math.max(0.8, c.r * 0.38);
          ctx!.save();
          ctx!.translate(c.x, c.y);
          ctx!.rotate(c.giro);
          ctx!.beginPath();
          for (let k = 0; k < 6; k++) {
            ctx!.rotate(Math.PI / 3);
            ctx!.moveTo(0, 0);
            ctx!.lineTo(0, -l);
            ctx!.moveTo(0, -l * 0.55);
            ctx!.lineTo(-l * 0.28, -l * 0.8);
            ctx!.moveTo(0, -l * 0.55);
            ctx!.lineTo(l * 0.28, -l * 0.8);
          }
          ctx!.stroke();
          ctx!.restore();
        } else {
          ctx!.beginPath();
          ctx!.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;

      // Trineos y sus estelas.
      for (let i = trineos.length - 1; i >= 0; i--) {
        if (moverTrineo(trineos[i], t, dt) && trineos[i].chispas.length === 0) {
          trineos[i].el.remove();
          trineos.splice(i, 1);
        } else if ((t - trineos[i].inicio) / trineos[i].dur >= 1) {
          trineos[i].el.style.visibility = 'hidden';
        }
      }
      pintarChispas(ctx!, chispasCielo, dt, t);

      // Entrada.
      if (trineoEntrada && ctxE) {
        moverTrineo(trineoEntrada, t, dt);
        revelarTitulo(dt);
        ctxE.clearRect(0, 0, W, H);
        pintarChispas(ctxE, chispasEntrada, dt, t);
        if (t - inicio > DUR_ENTRADA) {
          trineoEntrada.el.remove();
          trineoEntrada = null;
          chispasEntrada.length = 0;
          capaEntrada?.classList.remove('nv-entrada--activa');
        }
      }

      if (!document.hidden && activo) raf = requestAnimationFrame(cuadro);
    }

    function visibilidad() {
      if (document.hidden) {
        if (raf !== null) cancelAnimationFrame(raf);
        raf = null;
      } else if (raf === null && activo) {
        anterior = 0;
        raf = requestAnimationFrame(cuadro);
      }
    }

    medir();
    arrancarEntrada();
    raf = requestAnimationFrame(cuadro);
    window.addEventListener('resize', medir);
    document.addEventListener('visibilitychange', visibilidad);
    relojes.push(window.setTimeout(cruce, 7000));

    return () => {
      activo = false;
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener('resize', medir);
      document.removeEventListener('visibilitychange', visibilidad);
      relojes.forEach((r) => window.clearTimeout(r));
      animaciones.forEach((a) => a.cancel());
      trineos.forEach((tr) => tr.el.remove());
      trineoEntrada?.el.remove();
    };
  }, []);

  return (
    <>
      <div className="nv-capa" aria-hidden="true">
        <canvas ref={lienzo} className="nv-nieve" />
        <div ref={cielo} className="nv-cielo" />
      </div>
      <div ref={entrada} className="nv-entrada" aria-hidden="true">
        <span className="nv-noche" />
        <canvas ref={lienzoEntrada} className="nv-estela" />
        <div className="nv-llego">
          <p ref={titulo} className="nv-llego-titulo">¡Llegó la Navidad!</p>
          <p className="nv-llego-sub">De parte de todo El Portón</p>
        </div>
      </div>
    </>
  );
}
