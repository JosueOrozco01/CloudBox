import "./Cookies.css";
import Topbar from "../../components/TopBarPrincipal/Topbarprincipal";
import Footer from "../../components/FooterSignOut/Footer";

const sections = [
  {
    title: "1. ¿Qué son las cookies?",
    content:
      "Las cookies son pequeños archivos de texto que se almacenan en tu navegador cuando visitas un sitio web. Nos permiten recordar tus preferencias y reconocerte en visitas posteriores, mejorando tu experiencia dentro de CloudBox.",
  },
  {
    title: "2. Tipos de cookies que usamos",
    content:
      "Utilizamos cookies esenciales (necesarias para que la plataforma funcione, como mantener tu sesión iniciada), cookies de preferencias (como el idioma que elegiste) y cookies de análisis (para entender cómo se usa el sitio y mejorarlo).",
  },
  {
    title: "3. Cookies esenciales",
    content:
      "Estas cookies son indispensables para el funcionamiento de CloudBox, por ejemplo, para mantenerte autenticado mientras navegas entre páginas. No puedes desactivarlas sin afectar el funcionamiento del servicio.",
  },
  {
    title: "4. Cookies de preferencias",
    content:
      "Guardan configuraciones como el idioma en el que prefieres ver el sitio, para que no tengas que seleccionarlo cada vez que visitas CloudBox.",
  },
  {
    title: "5. Cookies de terceros",
    content:
      "Algunas funciones, como el traductor automático de la página, utilizan servicios de terceros (por ejemplo, Google) que pueden instalar sus propias cookies. Estas cookies están sujetas a las políticas de privacidad de dichos terceros.",
  },
  {
    title: "6. Cómo controlar las cookies",
    content:
      "Puedes eliminar o bloquear las cookies desde la configuración de tu navegador. Ten en cuenta que desactivar las cookies esenciales puede impedir que algunas partes de CloudBox funcionen correctamente, como mantener tu sesión iniciada.",
  },
  {
    title: "7. Cambios a esta política",
    content:
      "Podemos actualizar esta Política de Cookies periódicamente para reflejar cambios en las cookies que utilizamos. La fecha de la última actualización siempre estará visible en esta página.",
  },
  {
    title: "8. Contacto",
    content:
      "Si tienes preguntas sobre el uso de cookies en CloudBox, puedes contactarnos a través de nuestra página de Soporte.",
  },
];

export default function Cookies() {
  return (
    <div className="cookies-page">
      <Topbar />

      <main className="cookies-main">
        <div className="cookies-container">
          <h1 className="cookies-title">Política de cookies</h1>
          <p className="cookies-updated">Última actualización: 6 de octubre de 2026</p>

          <p className="cookies-intro">
            Esta política explica qué son las cookies, cuáles utilizamos en
            CloudBox y cómo puedes gestionarlas desde tu navegador.
          </p>

          <div className="cookies-sections">
            {sections.map((section) => (
              <section className="cookies-section" key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.content}</p>
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}