/* =============================================================
 * ICONOS DE LÍNEA (rediseño)
 *
 * Trazo único, sin relleno, en `currentColor`: el color lo pone el CSS.
 * Dibujados a mano en una cuadrícula de 24×24 para que todos tengan el
 * mismo grosor y peso visual.
 * ============================================================= */

import type { CategoriaId } from '@/types/menu';

type Props = { className?: string; size?: number };

function Svg({ className, size = 24, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const TRAZOS: Record<CategoriaId, React.ReactNode> = {
  hamburguesas: (
    <>
      <path d="M4 10.5C4 6.9 7.6 4.5 12 4.5s8 2.4 8 6H4z" />
      <path d="M3.5 13.5h17" />
      <path d="M4.5 16.5h15v.5a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17v-.5z" />
      <path d="M9 7.5h.01M12 6.8h.01M15 7.5h.01" />
    </>
  ),
  perros: (
    <>
      <path d="M3.5 12.5c0-1.4 1.1-2.5 2.5-2.5h12c1.4 0 2.5 1.1 2.5 2.5S19.4 15 18 15H6c-1.4 0-2.5-1.1-2.5-2.5z" />
      <path d="M2.5 12.5h19" />
      <path d="M5 16.5c.8 1.3 2.2 2 3.8 2h6.4c1.6 0 3-.7 3.8-2" />
      <path d="M7 12.5c1-1 2-1 3 0s2 1 3 0 2-1 3 0" />
    </>
  ),
  mazorcadas: (
    <>
      <path d="M12 3.5c2.6 0 4 3.4 4 7.5s-1.4 7.5-4 7.5-4-3.4-4-7.5 1.4-7.5 4-7.5z" />
      <path d="M8.5 9h7M8.2 12h7.6M8.7 15h6.6M12 3.5v15" />
      <path d="M12 18.5c-1.5 1.5-3.5 2-5.5 2 .2-2.4 1.1-4.3 2.6-5.6M12 18.5c1.5 1.5 3.5 2 5.5 2-.2-2.4-1.1-4.3-2.6-5.6" />
    </>
  ),
  salchipapas: (
    <>
      <path d="M6 10.5h12l-1.5 9.5h-9L6 10.5z" />
      <path d="M8 10.5 7.2 4.5M10.5 10.5 10.2 3.5M13.5 10.5l.3-6.5M16 10.5l.8-5.5" />
      <path d="M9 14.5c1.9 1.2 4.1 1.2 6 0" />
    </>
  ),
  pizzas: (
    <>
      <path d="M12 21 3.5 6.5C8.7 3.2 15.3 3.2 20.5 6.5L12 21z" />
      <path d="M5 9c4.3-2.4 9.7-2.4 14 0" />
      <circle cx="10.5" cy="11.5" r="1.1" />
      <circle cx="14" cy="13.5" r="1" />
      <circle cx="12" cy="16.5" r=".9" />
    </>
  ),
  infantil: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M12 3.5c-1.2 1-1.4 2.2-.6 3.4" />
    </>
  ),
  bebidas: (
    <>
      <path d="M6.5 8.5h11l-1.3 12h-8.4l-1.3-12z" />
      <path d="M5.5 8.5h13" />
      <path d="M12.5 8.5 14 3.5l3 .5" />
      <path d="M7.2 13h9.6" />
    </>
  ),
};

export function IconoCategoria({ cat, ...p }: Props & { cat: CategoriaId }) {
  return <Svg {...p}>{TRAZOS[cat] ?? TRAZOS.hamburguesas}</Svg>;
}

const VARIOS = {
  llama: (
    <path d="M12 21c3.6 0 6-2.5 6-6 0-4.5-4-6.5-4.5-10.5C10.5 6.5 9 9.3 9.5 12c-1-.4-1.8-1.3-2-2.5C6.5 11 6 12.5 6 15c0 3.5 2.4 6 6 6z" />
  ),
  carne: (
    <>
      <path d="M15.5 4.5c2.6 1.2 4.3 3.9 3.9 7-.5 4.2-4.6 7.5-9.2 7.5-3.6 0-6.2-2.2-6.2-5.2 0-2.2 1.4-3.6 3.3-4.4 1.6-.7 2.3-1.7 2.8-3.3.7-2.2 3.2-2.7 5.4-1.6z" />
      <circle cx="13.5" cy="10.5" r="2" />
    </>
  ),
  moto: (
    <>
      <circle cx="6" cy="16.5" r="3" />
      <circle cx="18" cy="16.5" r="3" />
      <path d="M6 16.5h6l3.5-6H19M9.5 10.5h4M15.5 10.5l-1.5-4h-2.5" />
    </>
  ),
  estrella: <path d="m12 3.5 2.6 5.3 5.9.8-4.3 4.2 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.2 5.9-.8L12 3.5z" />,
  bolsa: (
    <>
      <path d="M5.5 8h13l-1 12.5h-11L5.5 8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      <path d="M12 12.5c-1.4 1.1-2 2.2-2 3.2a2 2 0 0 0 4 0c0-1-.6-2.1-2-3.2z" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.3a8.5 8.5 0 1 1 15.6-4.6z" />
      <path d="M9 8.5c.2 2.8 2.7 5.6 6.5 6.5l1-1.5-2-1-1 .8c-1-.5-2-1.5-2.6-2.6l.8-1-1-2L9 8.5z" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.3 6.7h.01" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M20 10c0 5.5-8 11-8 11s-8-5.5-8-11a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  // ---- panel ----
  inicio: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9v10.5h4.5V15h3v4.5H18V9" />
    </>
  ),
  pedidos: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </>
  ),
  carta: (
    <>
      <path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3v-12z" />
      <path d="M5 16.5a3 3 0 0 1 3-3h11" />
      <path d="M9 8h6" />
    </>
  ),
  grafica: (
    <>
      <path d="M4 19.5h16" />
      <path d="M7 16v-4M11 16V8M15 16v-6M19 16V5.5" />
    </>
  ),
  ojo: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  salir: (
    <>
      <path d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14" />
      <path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
  campana: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  sonido: (
    <>
      <path d="M4 9.5h3l5-4v13l-5-4H4z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  silencio: (
    <>
      <path d="M4 9.5h3l5-4v13l-5-4H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  hamburguesaMenu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cuadricula: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  tabla: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
    </>
  ),
  subir: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
  etiqueta: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.6 6.6a1.4 1.4 0 0 1-2 0L3.5 12.2z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  recargar: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  dinero: (
    <>
      <rect x="3" y="6.5" width="18" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 9.5v5M17.5 9.5v5" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.6M17 14.8c1.9.5 3.1 1.9 3.5 4.2" />
    </>
  ),
  recibo: (
    <>
      <path d="M6 3.5h12v17l-2.5-1.5-2 1.5-1.5-1.5-1.5 1.5-2-1.5L6 20.5v-17z" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </>
  ),
  tienda: (
    <>
      <path d="M4 9.5 5.5 4.5h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5.5 11.5v8h13v-8M10 19.5v-4.5h4v4.5" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  externo: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
      <path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" />
    </>
  ),
  documento: (
    <>
      <path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5z" />
      <path d="M14 3.5V8h4.5M9 13h6M9 16.5h6" />
    </>
  ),
  prohibido: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </>
  ),
  lapiz: (
    <>
      <path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4z" />
      <path d="m13 7 4 4" />
    </>
  ),
  carrito: (
    <>
      <path d="M3.5 4.5h2l2.2 10h10.3l2-7H7" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </>
  ),
} as const;

export type NombreIcono = keyof typeof VARIOS;

export function Icono({ nombre, ...p }: Props & { nombre: NombreIcono }) {
  return <Svg {...p}>{VARIOS[nombre]}</Svg>;
}
