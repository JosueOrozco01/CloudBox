function ProfileForm() {
	return (
		<section className="profilePanel">
				<div className="profilePanelHeading">
					<h2>Información personal</h2>
					<p>Administra la información asociada a tu cuenta</p>
				</div>

				<div className="profilePhotoRow">
					<span className="profileAvatar profileAvatarLarge">CF</span>
					<div>
						<span className="secondaryButton profilePhotoButton">
							<span className="profileUploadIcon" aria-hidden="true"><span /></span>
							Cambiar foto
						</span>
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
						<input name="role" placeholder="Rol de la cuenta" type="text" />
					</label>
					<label>
						Estado
						<input name="status" placeholder="Estado de la cuenta" type="text" />
					</label>
					<label>
						Fecha de creación
						<div className="profileReadonlyInput">No disponible</div>
					</label>
				</div>

				<div className="profileFormActions">
					<button className="secondaryButton" type="button">Cancelar</button>
					<button className="primaryButton" type="button">Guardar cambios</button>
				</div>
			</section>
	);
}

export default ProfileForm;
