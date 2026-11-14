import type { MetadataRoute } from 'next';

/* =============================================================
 * MANIFIESTO DE LA WEB
 *
 * Es lo que lee el navegador cuando alguien "instala" la página en
 * el escritorio o el celular: nombre, colores e ÍCONO de la app.
 * Sin este archivo el navegador usaba el favicon por defecto de
 * Next (el triángulo de Vercel) en la barra de tareas.
 *
 * El panel tiene su propio manifiesto (public/admin.webmanifest),
 * para que al instalarlo abra directo en /admin.
 * ============================================================= */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'El Portón Cajicá',
    short_name: 'El Portón',
    description: 'Comidas rápidas y pizzas artesanales en Cajicá. Pide fácil por WhatsApp.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B0B0B',
    theme_color: '#0B0B0B',
    icons: [
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/favicon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
    ],
  };
}
