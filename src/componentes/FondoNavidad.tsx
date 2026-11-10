/* =============================================================
 * FONDO DE NAVIDAD (detrás de toda la página)
 *
 * Va dentro de #page-bg (la capa fija de FondoParticulas), así que
 * queda detrás de todo el contenido. Solo se ve en temporada
 * (`data-temporada="navidad"`, ver lib/temporada.ts).
 *
 * Un cielo de noche azul estrellado: tres capas de estrellas de
 * distinto tamaño que titilan a ritmos distintos, algunas estrellas
 * más brillantes con destello, luz de luna arriba y, de vez en cuando,
 * una estrella fugaz. Todo es CSS (estilos-navidad.css).
 * ============================================================= */

export default function FondoNavidad() {
  return (
    <div className="nv-solo nv-fondo" aria-hidden="true">
      <span className="nv-estrellas nv-estrellas--1" />
      <span className="nv-estrellas nv-estrellas--2" />
      <span className="nv-estrellas nv-estrellas--3" />
      <span className="nv-brillante nv-brillante--1" />
      <span className="nv-brillante nv-brillante--2" />
      <span className="nv-brillante nv-brillante--3" />
      <span className="nv-brillante nv-brillante--4" />
      <span className="nv-fugaz nv-fugaz--1" />
      <span className="nv-fugaz nv-fugaz--2" />
    </div>
  );
}
