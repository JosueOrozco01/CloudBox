import "./Terms.css";
import Topbar from "../../components/TopBarPrincipal/Topbarprincipal";
import Footer from "../../components/FooterSignOut/Footer";

const sections = [
  {
    title: "1. Aceptación de los términos",
    content:
      "Al crear una cuenta o utilizar CloudBox, aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo con alguna parte de estos términos, no debes utilizar el servicio.",
  },
  {
    title: "2. Descripción del servicio",
    content:
      "CloudBox es una plataforma de almacenamiento en la nube que permite guardar, organizar y compartir archivos de forma segura. Nos reservamos el derecho de modificar, suspender o descontinuar cualquier parte del servicio en cualquier momento.",
  },
  {
    title: "3. Registro de cuenta",
    content:
      "Para usar CloudBox debes crear una cuenta proporcionando información veraz y actualizada. Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad que ocurra bajo tu cuenta.",
  },
  {
    title: "4. Uso aceptable",
    content:
      "Te comprometes a no utilizar CloudBox para almacenar o compartir contenido ilegal, dañino, difamatorio, o que infrinja derechos de propiedad intelectual de terceros. Nos reservamos el derecho de suspender cuentas que incumplan esta política.",
  },
  {
    title: "5. Almacenamiento y disponibilidad",
    content:
      "Aunque trabajamos para mantener el servicio disponible de forma continua, no garantizamos un acceso ininterrumpido. Te recomendamos mantener copias de respaldo de tus archivos más importantes.",
  },
  {
    title: "6. Propiedad intelectual",
    content:
      "Tú conservas todos los derechos sobre los archivos que subes a CloudBox. No reclamamos propiedad sobre tu contenido; únicamente lo almacenamos y procesamos según sea necesario para prestar el servicio.",
  },
  {
    title: "7. Privacidad",
    content:
      "El tratamiento de tus datos personales se rige por nuestra Política de Privacidad, la cual forma parte de estos Términos y Condiciones.",
  },
  {
    title: "8. Limitación de responsabilidad",
    content:
      "CloudBox no será responsable por daños indirectos, pérdida de datos, o lucro cesante derivados del uso o la imposibilidad de uso del servicio, en la medida permitida por la ley aplicable.",
  },
  {
    title: "9. Cambios a estos términos",
    content:
      "Podemos actualizar estos Términos y Condiciones periódicamente. Te notificaremos sobre cambios significativos, y el uso continuado del servicio después de dichos cambios constituye tu aceptación de los mismos.",
  },
  {
    title: "10. Contacto",
    content:
      "Si tienes preguntas sobre estos Términos y Condiciones, puedes contactarnos a través de nuestra página de Soporte.",
  },
];

export default function Terms() {
  return (
    <div className="terms-page">
      <Topbar />

      <main className="terms-main">
        <div className="terms-container">
          <h1 className="terms-title">Términos y condiciones</h1>
          <p className="terms-updated">Última actualización: 6 de octubre de 2026</p>

          <p className="terms-intro">
            Estos Términos y Condiciones regulan el uso de CloudBox. Por favor,
            léelos cuidadosamente antes de utilizar nuestros servicios.
          </p>

          <div className="terms-sections">
            {sections.map((section) => (
              <section className="terms-section" key={section.title}>
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