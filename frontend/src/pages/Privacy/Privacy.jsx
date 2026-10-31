import LegalDocument from "../../components/LegalDocument/LegalDocument";

const sections = [
  {
    title: "1. Información que recopilamos",
    content:
      "Recopilamos la información que nos proporcionas directamente al crear una cuenta (nombre, apellidos, correo electrónico y contraseña), así como los archivos que subes a CloudBox. También recopilamos información técnica básica, como tu dirección IP y el tipo de navegador, para mantener la seguridad del servicio.",
  },
  {
    title: "2. Cómo usamos tu información",
    content:
      "Usamos tu información para crear y administrar tu cuenta, brindarte acceso a tus archivos, enviarte notificaciones relevantes sobre el servicio (como códigos de recuperación de contraseña), y mejorar la seguridad y el funcionamiento de CloudBox.",
  },
  {
    title: "3. Con quién compartimos tu información",
    content:
      "No vendemos ni compartimos tu información personal con terceros con fines publicitarios. Podemos compartir información únicamente cuando sea necesario para operar el servicio (por ejemplo, con proveedores de infraestructura en la nube) o cuando la ley nos obligue a hacerlo.",
  },
  {
    title: "4. Cookies y tecnologías similares",
    content:
      "Utilizamos cookies para mantener tu sesión iniciada, recordar tus preferencias (como el idioma del sitio) y entender cómo se usa la plataforma. Puedes gestionar las cookies desde la configuración de tu navegador.",
  },
  {
    title: "5. Seguridad de tus datos",
    content:
      "Implementamos medidas técnicas y organizativas para proteger tu información, incluyendo el cifrado de contraseñas y conexiones seguras. Sin embargo, ningún sistema es 100% infalible, por lo que te recomendamos usar contraseñas robustas y no compartirlas.",
  },
  {
    title: "6. Tus derechos",
    content:
      "Puedes acceder, corregir o eliminar tu información personal en cualquier momento desde la sección de tu perfil, o contactándonos directamente. También puedes solicitar la eliminación total de tu cuenta y los datos asociados.",
  },
  {
    title: "7. Retención de datos",
    content:
      "Conservamos tu información mientras tu cuenta esté activa. Si decides eliminar tu cuenta, tus datos y archivos serán eliminados de nuestros servidores dentro de un plazo razonable, salvo que la ley nos exija conservarlos por más tiempo.",
  },
  {
    title: "8. Menores de edad",
    content:
      "CloudBox no está dirigido a menores de 13 años, y no recopilamos intencionalmente información personal de niños. Si consideras que un menor nos ha proporcionado información personal, contáctanos para eliminarla.",
  },
  {
    title: "9. Cambios a esta política",
    content:
      "Podemos actualizar esta Política de Privacidad periódicamente. Te notificaremos sobre cambios significativos, y la fecha de la última actualización siempre estará visible en esta página.",
  },
  {
    title: "10. Contacto",
    content:
      "Si tienes preguntas sobre cómo manejamos tu información personal, puedes contactarnos a través de nuestra página de Soporte.",
  },
];

export default function Privacy({ embedded = false }) {
  return <LegalDocument kind="privacy" embedded={embedded} intro="En CloudBox nos tomamos muy en serio la privacidad de tus datos. Esta política explica qué información recopilamos, cómo la usamos y qué derechos tienes sobre ella." sections={sections} />;
}
