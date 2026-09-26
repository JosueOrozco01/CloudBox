function Topbar() {
	return (
		<header className="landing-nav">
			<div className="landing-nav-inner">
				<a className="landing-logo" href="/">
					<img src="/logo-cloudbox.png" alt="CloudBox" />
				</a>
				<nav className="landing-nav-links">
					<a href="características">Características</a>
					<a href="planes">Planes</a>
					<a href="seguridad">Seguridad</a>
					<a href="sobrenosotros">Sobre nosotros</a>
					<a href="soporte">Soporte</a>
				</nav>
				<div className="landing-nav-cta">
					<a href="paginadeiniciarsesion">Iniciar sesión</a>
					<button className="btn-primary" type="button">Crear cuenta</button>
				</div>
			</div>
		</header>
	);
}
export default Topbar;
