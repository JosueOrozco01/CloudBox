import logo from "../images/logo.jpeg";

export function Navbar() {
    return (
        <footer className="landing-footer">
            <div className="landing-footer-content">
                <div className="landing-footer-brand">
                    <a className="landing-footer-logo">
                        <img src={logo} alt="CloudBox" />
                    </a>
                    <p>Guarda, comparte y accede a tus archivos de forma segura desde cualquier lugar del mundo.</p>
                </div>
                <div className="landing-footer-links">
                    <div className="landing-footer-column">
                        <h3>Producto</h3>
                        <a href="características">Características</a>
                        <a href="planes">Planes</a>
                        <a href="seguridad">Seguridad</a>
                    </div>
                    <div className="landing-footer-column">
                        <h3>Empresa</h3>
                        <a href="sobre-nosotros">Sobre nosotros</a>
                        <a href="contacto">Soporte</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Navbar;