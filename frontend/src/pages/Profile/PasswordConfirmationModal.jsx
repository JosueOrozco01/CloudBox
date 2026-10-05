import "./PasswordConfirmationModal.css";

function PasswordConfirmationModal({ isOpen, onClose, onConfirm }) {
	if (!isOpen) {
		return null;
	}

	const handleSubmit = (event) => {
		event.preventDefault();
		onConfirm();
	};

	return (
		<div className="passwordModalBackdrop" onClick={onClose}>
			<div
				className="passwordModal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="passwordModalTitle"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="passwordModalHeader">
					<h2 id="passwordModalTitle">Confirma tu contraseña</h2>
					<button
						className="passwordModalClose"
						type="button"
						onClick={onClose}
						aria-label="Cerrar ventana"
					>
						×
					</button>
				</div>
				<p className="passwordModalMessage">
					Escribe la contraseña del dueño del perfil para guardar los cambios.
				</p>

				<form onSubmit={handleSubmit}>
					<label className="passwordModalLabel" htmlFor="profilePassword">
						Contraseña
					</label>
					<input
						className="passwordModalInput"
						id="profilePassword"
						name="profilePassword"
						type="password"
						autoFocus
					/>

					<div className="passwordModalActions">
						<button className="secondaryButton" type="button" onClick={onClose}>
							Cancelar
						</button>
						<button className="primaryButton" type="submit">
							Confirmar y guardar
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default PasswordConfirmationModal;