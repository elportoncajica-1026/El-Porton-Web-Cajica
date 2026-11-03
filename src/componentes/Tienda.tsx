'use client';

/* =============================================================
 * TIENDA — todo lo que pide algo
 *
 * Agrupa las secciones que necesitan compartir estado con el modal o
 * con el catálogo:
 *
 *   Favoritos  → "Agregar" abre el mismo modal que el catálogo.
 *   Combo      → "Armar mi combo" cambia la categoría del catálogo y
 *                baja hasta él.
 *   Cómo pedir → va justo antes de la carta (decisión del cliente).
 *   Catálogo   → la carta completa con su selector de categorías.
 *
 * Por eso la categoría activa vive AQUÍ y no dentro del catálogo: si
 * viviera dentro, el banner del combo no tendría cómo cambiarla.
 * ============================================================= */

import { useMemo, useState } from 'react';
import type { Categoria, CategoriaId, ProductoMenu } from '@/types/menu';
import { categoriasConProductos } from '@/lib/catalogo';
import { CATEGORIA_COMBO } from '@/data/portada';
import Carrito from './Carrito';
import { TIEMPOS_POR_DEFECTO, type Tiempos } from '@/lib/tiempos';
import BotonPreguntar from './BotonPreguntar';
import Catalogo from './Catalogo';
import ModalProducto from './ModalProducto';
import Favoritos from './Favoritos';
import BannerCombo from './BannerCombo';
import { ComoPedir, EncabezadoCarta } from './Secciones';

export default function Tienda({
  menu,
  categorias,
  tiempos = TIEMPOS_POR_DEFECTO,
}: {
  menu: ProductoMenu[];
  categorias: Categoria[];
  /** Tiempos de entrega que muestra el carrito (se editan en el panel). */
  tiempos?: Tiempos;
}) {
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = abiertoId ? (menu.find((p) => p.id === abiertoId) ?? null) : null;

  const pestanas = useMemo(() => categoriasConProductos(menu, categorias), [menu, categorias]);
  const [catActiva, setCatActiva] = useState<CategoriaId>(() => pestanas[0]?.key ?? categorias[0].key);

  function irACombo() {
    if (pestanas.some((c) => c.key === CATEGORIA_COMBO)) setCatActiva(CATEGORIA_COMBO);
    document.getElementById('menu-catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <Favoritos menu={menu} onPersonalizar={setAbiertoId} />
      <BannerCombo onVer={irACombo} />

      {/* Antes de la carta: el cliente ve cómo se pide antes de elegir. */}
      <ComoPedir />

      <EncabezadoCarta
        id="menu-catalogo"
        eyebrow="Nuestra carta"
        titulo="Elige tu antojo"
        sub="Explora nuestras categorías y descubre tu nuevo favorito."
      />
      <Catalogo
        menu={menu}
        pestanas={pestanas}
        catActiva={catActiva}
        onCambiarCategoria={setCatActiva}
        onPersonalizar={setAbiertoId}
      />

      <ModalProducto item={abierto} onCerrar={() => setAbiertoId(null)} />
      <Carrito tiempos={tiempos} />
      <BotonPreguntar />
    </>
  );
}
