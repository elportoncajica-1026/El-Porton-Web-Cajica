import type { Viewport } from 'next';
import { CATEGORIES } from '@/data/menu';
import { obtenerMenu } from '@/lib/menu-servidor';
import { obtenerTiempos } from '@/lib/tiempos-servidor';
import Navbar from '@/componentes/Navbar';
import Hero from '@/componentes/Hero';
import Tienda from '@/componentes/Tienda';
import RevelarAlScroll from '@/componentes/RevelarAlScroll';
import Lightbox from '@/componentes/Lightbox';
import InsigniaHorario from '@/componentes/InsigniaHorario';
import DatosEstructurados from '@/componentes/DatosEstructurados';
import FondoParticulas from '@/componentes/FondoParticulas';
import Rastreo from '@/componentes/Rastreo';
import { AmbienteHalloween } from '@/componentes/DecoracionHalloween';
import MurcielagosHalloween from '@/componentes/MurcielagosHalloween';
import { Contacto, LlamadoPedido, Nosotros, PieDePagina, Testimonios } from '@/componentes/Secciones';

/* =============================================================
 * PORTADA
 *
 * Componente de SERVIDOR: hace `await` sobre el menú directamente,
 * sin useEffect ni estados de carga. Cuando el HTML sale hacia el
 * navegador, los productos ya van dentro.
 *
 * Orden del rediseño (2026-10, sobre el prototipo aprobado por el
 * cliente):
 *   Hero → favoritos de la casa → banner de combo → cómo pedir →
 *   "Elige tu antojo" (carta completa) → testimonios → nosotros → contacto →
 *   ¿listo para pedir? → pie.
 *
 * `.page-dark` envuelve nosotros/contacto/llamado: es un fondo negro
 * opaco que tapa el lienzo de partículas de ahí hacia abajo.
 * ============================================================= */

/* Celular: la página abre al 85%, como bajar el zoom de la pestaña en el
 * navegador (pedido del cliente: "se ve muy compacto"). El diseño no
 * cambia, solo se ve todo más pequeño y cabe más en pantalla. En
 * computador los navegadores ignoran esto. El panel (/admin) sigue al 100%. */
export const viewport: Viewport = {
  themeColor: '#0B0B0B',
  width: 'device-width',
  initialScale: 0.85,
};

export default async function Portada() {
  // En paralelo: el menú y los tiempos de entrega del carrito (ninguno lanza).
  const [{ menu }, tiempos] = await Promise.all([obtenerMenu(), obtenerTiempos()]);

  return (
    <>
      <DatosEstructurados menu={menu} />
      <Rastreo />

      {/* Va primero: es el fondo de TODA la página (fijo, z-index −1).
          `.hero` y `.page-dark` lo tapan con negro opaco donde no debe
          verse — el mismo truco que usa v1. */}
      <FondoParticulas />

      <Navbar />
      {/* Solo se ve en temporada (lib/temporada.ts): niebla, murciélagos y araña. */}
      <AmbienteHalloween />
      <MurcielagosHalloween />
      <InsigniaHorario />

      <main>
        <Hero />

        {/* Favoritos, combo y la carta completa comparten estado con el modal. */}
        <Tienda menu={menu} categorias={CATEGORIES} tiempos={tiempos} />

        <Testimonios />

        <div className="page-dark">
          <Nosotros />
          <Contacto />
          <LlamadoPedido />
        </div>
      </main>

      <PieDePagina />

      <Lightbox menu={menu} />
      <RevelarAlScroll />
    </>
  );
}
