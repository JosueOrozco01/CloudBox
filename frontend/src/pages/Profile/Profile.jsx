/*
 * CloudBox - Perfil del Usuario
 *
 * Vista visual de perfil con datos de ejemplo locales.
 *
 * Secciones:
 *
 * - Información personal.
 * - Correo.
 * - Seguridad.
 * - Cambio de contraseña.
 * - Preferencias.
 *
 * No consulta ni guarda datos en servicios, backend o base de datos.
 */

import ProfileForm from "./ProfileForm.jsx";
import StorageSummary from "./StorageSummary.jsx";
import "./Profile.css";

function UserProfile() {
	return (
		<div className="profilePage">
			{/* Topbar */}
			<main className="profileMain">
				<div className="profileContent">
					<aside className="profileTabs" aria-label="Configuración de cuenta">
						<button className="profileTab profileTabActive" type="button">Perfil</button>
						<button className="profileTab" type="button">Seguridad</button>
						<button className="profileTab" type="button">Preferencias</button>
					</aside>
					<section className="profilePanels">
						<ProfileForm />
						<StorageSummary />
						<section className="profilePanel profileAccountPanel">
							<div className="profilePanelHeading">
								<h2>Cuenta</h2>
								<p>Si cierras sesión tendrás que ingresar tus credenciales nuevamente. Si decides eliminar tu cuenta, todos tus archivos se borrarán permanentemente.</p>
							</div>
							<div className="profileAccountActions">
								<button className="secondaryButton" type="button">Cerrar sesión</button>
								<button className="dangerButton" type="button">Eliminar cuenta</button>
							</div>
						</section>
					</section>
				</div>
			</main>
		</div>
	);
}

export default UserProfile;