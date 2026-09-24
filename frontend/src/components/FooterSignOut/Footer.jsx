import "./Footer.css";

const columns = [
  {
    title: "Producto",
    links: [
      { label: "Características", href: "/caracteristicas" },
      { label: "Planes", href: "/planes" },
      { label: "Seguridad", href: "/seguridad" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre nosotros", href: "/nosotros" },
      { label: "Contacto", href: "/contacto" },
      { label: "Prensa", href: "/prensa" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos y condiciones", href: "/terminos" },
      { label: "Política de privacidad", href: "/privacidad" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

const icon = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          {/* Marca */}
          <div className="footer-brand">
            {/* Coloca tu logo (versión blanca) en public con este nombre */}
            <img src="/logo-cloudbox1.png" alt="CloudBox" />
            <p>
              Guarda, comparte y accede a tus archivos de
              <br />
              forma segura desde cualquier lugar del mundo.
            </p>
          </div>

          {/* Columnas de enlaces */}
          <nav className="footer-columns" aria-label="Enlaces del pie de página">
            {columns.map((col) => (
              <div className="footer-col" key={col.title}>
                <h3>{col.title}</h3>
                <ul>
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="footer-bottom">
          <p className="copyright">© 2026 CloudBox. Todos los derechos reservados.</p>

          <div className="footer-actions">
            <a href="https://twitter.com" aria-label="Twitter" className="social">
              <svg {...icon}>
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2Z" />
              </svg>
            </a>
            <a href="https://facebook.com" aria-label="Facebook" className="social">
              <svg {...icon}>
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            <a href="https://instagram.com" aria-label="Instagram" className="social">
              <svg {...icon}>
                <rect width="20" height="20" x="2" y="2" rx="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>

            <button type="button" className="lang">
              <svg {...icon} width="15" height="15">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Español
              <svg {...icon} width="12" height="12" strokeWidth={3}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}