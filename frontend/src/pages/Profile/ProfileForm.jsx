import { useState } from "react";
import { Upload } from "lucide-react";
import PasswordConfirmationModal from "./PasswordConfirmationModal.jsx";

function ProfileForm() {
	const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

	const handlePasswordConfirmation = () => {
		setIsPasswordModalOpen(false);
	};

	return (
		<>
		<section className="profilePanel">
				<div className="profilePanelHeading">
					<h2>Información personal</h2>
					<p>Administra la información asociada a tu cuenta</p>
				</div>

				<div className="profilePhotoRow">
					<span className="profileAvatar profileAvatarLarge">CF</span>
					<div>
						<button className="secondaryButton profilePhotoButton" type="button">
							<Upload className="profileUploadIcon" size={16} strokeWidth={2.2} aria-hidden="true" />
							Cambiar foto
						</button>
						<small>Recomendado: JPG o PNG de al menos 400x400px</small>
					</div>
				</div>

				<div className="profileFormGrid">
					<label>
						Nombre
						<input defaultValue="Nombre" name="firstName" type="text" />
					</label>
					<label>
						Apellido
						<input defaultValue="Apellido" name="lastName" type="text" />
					</label>
					<label>
						Correo electrónico
						<input defaultValue="Correo electrónico" name="email" type="email" />
					</label>
					<label>
						Rol
						<div className="profileReadonlyInput">
							<span>No se puede modificar</span>
							<img className="profileReadonlyIcon" src="/seguro.png" alt="" />
						</div>
					</label>
					<label>
						Estado
						<div className="profileReadonlyInput">
							<span>No se puede modificar</span>
							<img className="profileReadonlyIcon" src="/seguro.png" alt="" />
						</div>
					</label>
					<label>
						Fecha de creación
						<div className="profileReadonlyInput">
							<span>No se puede modificar</span>
							<img className="profileReadonlyIcon" src="/seguro.png" alt="" />
						</div>
					</label>
				</div>

				<div className="profileFormActions">
					<button className="secondaryButton" type="button">Cancelar</button>
					<button
						className="primaryButton"
						type="button"
						onClick={() => setIsPasswordModalOpen(true)}
					>
						Guardar cambios
					</button>
					<button className="passwordButton" type="button">
						Cambiar contraseña
					</button>
				</div>
			</section>
			<PasswordConfirmationModal
				isOpen={isPasswordModalOpen}
				onClose={() => setIsPasswordModalOpen(false)}
				onConfirm={handlePasswordConfirmation}
			/>
		</>
	);
}

export default ProfileForm;
