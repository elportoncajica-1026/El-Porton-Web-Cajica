import type { Metadata } from 'next';
import Link from 'next/link';

/* =============================================================
 * PÁGINA LEGAL: Términos y Condiciones + Política de Datos
 *
 * Portada de docs/legal.html del sitio v1 (mismas clases legal-*,
 * que ya viven en estilos-v1.css). Los datos del responsable son
 * los que dieron los dueños, escritos tal cual.
 * ============================================================= */

export const metadata: Metadata = {
  title: 'Términos y Política de Datos — El Portón Cajicá',
  description: 'Términos y Condiciones y Política de Tratamiento de Datos Personales de El Portón Cajicá (Ley 1581 de 2012).',
  alternates: { canonical: '/legal' },
};

const RAZON_SOCIAL = 'Comidas Rapidas El Porton';
const RESPONSABLE = 'Felipe Andres Reyes Lombo';
const NIT = '107010984-0';
const CORREO = 'elportoncajica@gmail.com';

const Correo = () => <a href={`mailto:${CORREO}`}>{CORREO}</a>;

export default function Legal() {
  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link href="/" aria-label="Volver al inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-final.png" alt="El Portón Cajicá" className="logo-img" />
        </Link>
        <Link href="/" className="legal-back">
          ← Volver a la tienda
        </Link>
      </nav>

      <main className="legal-wrap">
        <h1 className="legal-h1">Términos y Política de Datos</h1>
        <p className="legal-updated">Última actualización: 25 de noviembre de 2026</p>

        <div className="legal-toc">
          <a href="#terminos">Términos y Condiciones</a>
          <a href="#datos">Política de Tratamiento de Datos</a>
        </div>

        {/* ============================ TÉRMINOS ============================ */}
        <section id="terminos" className="legal-section">
          <h2 className="legal-h2">Términos y Condiciones</h2>

          <p>
            Bienvenido a <strong>El Portón Cajicá</strong>. Al usar este sitio web y realizar un pedido a través de él,
            aceptas los siguientes términos y condiciones. Te pedimos leerlos con atención.
          </p>

          <h3 className="legal-h3">1. Quiénes somos</h3>
          <p>
            Este sitio es operado por <strong>{RAZON_SOCIAL}</strong> (responsable: {RESPONSABLE}), identificado con
            NIT {NIT}, con domicilio en Calle 11 A Sur #10-75, Camino entrada Fagua, sector Canelón,
            Cajicá, Cundinamarca, Colombia. Canal de contacto: WhatsApp{' '}
            <a href="https://wa.me/573138214752" target="_blank" rel="noopener">
              +57 313 821 4752
            </a>{' '}
            · Instagram{' '}
            <a href="https://instagram.com/elportoncajica" target="_blank" rel="noopener">
              @elportoncajica
            </a>
            .
          </p>

          <h3 className="legal-h3">2. Objeto del sitio</h3>
          <p>
            El sitio permite consultar nuestra carta y armar un pedido. El pedido <strong>no se paga ni se cierra en el
            sitio</strong>: al enviarlo, se genera un mensaje que se abre en WhatsApp para que un asesor lo confirme
            (disponibilidad, valor del domicilio, tiempo de entrega y total final) antes de prepararlo.
          </p>

          <h3 className="legal-h3">3. Precios y disponibilidad</h3>
          <ul>
            <li>Todos los precios están expresados en pesos colombianos (COP) e incluyen los impuestos aplicables.</li>
            <li>Los precios y la disponibilidad de los productos pueden cambiar sin previo aviso.</li>
            <li>
              El <strong>valor del domicilio no está incluido</strong> en los precios mostrados; lo calcula y confirma el
              asesor según la zona de entrega.
            </li>
            <li>Un pedido solo se considera confirmado cuando el asesor lo acepta por WhatsApp.</li>
            <li>
              Las bebidas alcohólicas se venden solo a mayores de edad. Prohibido el expendio de bebidas embriagantes a
              menores de edad. El exceso de alcohol es perjudicial para la salud.
            </li>
          </ul>

          <h3 className="legal-h3">4. Horarios y cobertura de domicilios</h3>
          <p>
            Atendemos de martes a domingo, de 1:00 PM a 10:00 PM (lunes cerrado, salvo festivos). Los domicilios se toman
            por WhatsApp hasta las 9:40 PM. La cobertura y los tiempos de entrega dependen de la zona y la demanda del
            momento.
          </p>

          <h3 className="legal-h3">5. Métodos de pago</h3>
          <p>
            El pago se realiza al momento de la entrega o según lo acuerde el asesor, mediante efectivo o tarjeta /
            transferencia. Si pagas en efectivo, puedes indicar con cuánto pagas para agilizar el cambio.
          </p>

          <h3 className="legal-h3">6. Propiedad intelectual</h3>
          <p>
            La marca, el logo, los textos, las fotografías y el diseño de este sitio son propiedad de El Portón Cajicá y no
            pueden ser reproducidos sin autorización.
          </p>

          <h3 className="legal-h3">7. Responsabilidad</h3>
          <p>
            Nos esforzamos por mantener la información (fotos, descripciones y precios) lo más exacta posible; sin embargo,
            pueden existir variaciones. Ante cualquier diferencia, prevalece lo confirmado por el asesor en WhatsApp.
          </p>

          <h3 className="legal-h3">8. Ley aplicable</h3>
          <p>Estos términos se rigen por las leyes de la República de Colombia.</p>
        </section>

        {/* ============================ DATOS ============================ */}
        <section id="datos" className="legal-section">
          <h2 className="legal-h2">Política de Tratamiento de Datos Personales</h2>

          <p>
            En cumplimiento de la <strong>Ley 1581 de 2012</strong> y el <strong>Decreto 1377 de 2013</strong> sobre
            protección de datos personales, informamos cómo recolectamos y usamos tus datos.
          </p>

          <h3 className="legal-h3">1. Responsable del tratamiento</h3>
          <ul>
            <li>
              <strong>Razón social:</strong> {RAZON_SOCIAL}
            </li>
            <li>
              <strong>Responsable:</strong> {RESPONSABLE}
            </li>
            <li>
              <strong>NIT:</strong> {NIT}
            </li>
            <li>
              <strong>Domicilio:</strong> Calle 11 A Sur #10-75, Camino entrada Fagua, sector Canelón, Cajicá,
              Cundinamarca.
            </li>
            <li>
              <strong>Correo para asuntos de datos:</strong> <Correo />
            </li>
            <li>
              <strong>WhatsApp:</strong> +57 313 821 4752
            </li>
          </ul>

          <h3 className="legal-h3">2. Datos que recolectamos</h3>
          <p>
            Para gestionar tu pedido recolectamos únicamente los datos que ingresas en el formulario de entrega:{' '}
            <strong>nombre completo, número de teléfono y dirección de entrega</strong>, además del detalle de tu pedido y
            el método de pago elegido.
          </p>
          <p>
            Para saber cuántas personas visitan el sitio, tu navegador guarda un identificador aleatorio que no contiene tu
            nombre ni tus datos de contacto, y registramos por qué medio llegaste (por ejemplo, un anuncio, una red social o
            un código QR) y qué platos abriste. Mientras no hagas un pedido, esa información no está ligada a ti. No usamos
            cookies de publicidad.
          </p>
          <p>
            Si haces un pedido, guardamos junto a él por qué medio llegaste y, si decides responderla, la pregunta
            &quot;¿Cómo nos conociste?&quot;.
          </p>

          <h3 className="legal-h3">3. Finalidad del tratamiento</h3>
          <ul>
            <li>Recibir, procesar, preparar y entregar tu pedido.</li>
            <li>Contactarte por WhatsApp o teléfono para confirmar o coordinar la entrega.</li>
            <li>Atender peticiones, quejas o reclamos relacionados con tu pedido.</li>
            <li>
              Analizar las ventas: saber qué anuncios, redes y platos funcionan, y reconocer a los clientes que vuelven a
              pedir.
            </li>
            <li>
              Enviarte promociones y novedades por WhatsApp, <strong>solo si lo autorizas</strong> con la casilla opcional
              del carrito. Puedes pedir que dejemos de enviarlas cuando quieras.
            </li>
          </ul>
          <p>No vendemos ni compartimos tus datos con terceros con fines comerciales.</p>

          <h3 className="legal-h3">4. Autorización</h3>
          <p>
            Al marcar la casilla de autorización y enviar tu pedido, autorizas de forma libre, previa e informada el
            tratamiento de tus datos personales para las finalidades aquí descritas, salvo el envío de promociones, que
            requiere marcar su propia casilla.
          </p>

          <h3 className="legal-h3">5. Derechos del titular</h3>
          <p>Como titular de tus datos, tienes derecho a:</p>
          <ul>
            <li>Conocer, actualizar y rectificar tus datos.</li>
            <li>Solicitar prueba de la autorización otorgada.</li>
            <li>Ser informado sobre el uso que se da a tus datos.</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</li>
            <li>Revocar la autorización y/o solicitar la supresión de tus datos cuando proceda.</li>
            <li>Acceder de forma gratuita a tus datos personales.</li>
          </ul>

          <h3 className="legal-h3">6. Cómo ejercer tus derechos</h3>
          <p>
            Puedes ejercer estos derechos escribiendo al correo <Correo /> o por WhatsApp al +57 313
            821 4752. Las consultas se atienden en un máximo de diez (10) días hábiles y los reclamos en un máximo de
            quince (15) días hábiles, conforme a la ley.
          </p>

          <h3 className="legal-h3">7. Conservación y almacenamiento</h3>
          <p>
            Los pedidos se guardan en la base de datos del negocio, a la que solo acceden sus administradores. El sitio y
            la base de datos funcionan con proveedores de servicios en la nube (Vercel y Supabase) con servidores en
            Estados Unidos, que actúan como encargados y no usan tus datos para fines propios. Conservamos tus datos
            únicamente durante el tiempo necesario para cumplir las finalidades descritas y las obligaciones legales
            aplicables.
          </p>
          <p>
            Además, los datos que escribes en el formulario se recuerdan en tu propio dispositivo para tu comodidad; puedes
            borrarlos vaciando los datos del navegador.
          </p>

          <h3 className="legal-h3">8. Vigencia</h3>
          <p>
            Esta política rige a partir de su publicación y podrá ser actualizada. Cualquier cambio se reflejará en esta
            misma página con su fecha de actualización.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <p className="site-footer-logo">El Portón Cajicá</p>
        <p className="site-footer-tag">Comidas Rápidas &amp; Pizzería Artesanal · Cajicá, Cundinamarca</p>
        <p className="site-footer-copy">
          © {new Date().getFullYear()} El Portón Cajicá. <Link href="/">Volver a la tienda</Link>
        </p>
      </footer>
    </div>
  );
}
