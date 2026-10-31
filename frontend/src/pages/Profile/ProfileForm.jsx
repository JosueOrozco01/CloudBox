import UserAvatar from "../../components/UserAvatar/UserAvatar";
import { date } from "../../utils/moduleFormat";
import { useState } from "react";
import { LockKeyhole, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { updateMyProfile } from "../../services/profileService";
import Loading from "../../components/Loading/Loading";
import AlertModal from "../../components/AlertModal/AlertModal";

function ProfileForm({ user, onProfileUpdated }) {
  const [firstName, setFirstName] = useState(user.nombre || "");
  const [lastName, setLastName] = useState(user.apellido || "");
  const [isSaving, setIsSaving] = useState(false);

  const [alert, setAlert] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: ""
  });

  const showAlert = (type, title, message) => {
    setAlert({
      isOpen: true,
      type,
      title,
      message
    });
  };

  const closeAlert = () => {
    setAlert((prev) => ({
      ...prev,
      isOpen: false
    }));
  };

  const navigate = useNavigate();

  const handleChangePassword = () => {
    navigate("/perfil?tab=seguridad");
  };

  const formattedDate = date(user.fecha_registro);

  const handleCancel = () => {
    setFirstName(user.nombre || "");
    setLastName(user.apellido || "");
    closeAlert();
  };

  const handleSave = async () => {
    if (isSaving) return;

    const nombre = firstName.trim();
    const apellido = lastName.trim();

    // Validar nombre obligatorio
    if (!nombre) {
      showAlert(
        "warning",
        "Campo obligatorio",
        "El nombre es obligatorio."
      );
      return;
    }

    // Identificar qué datos cambiaron
    const nombreCambio = nombre !== (user.nombre || "");
    const apellidoCambio = apellido !== (user.apellido || "");

    // Si no hubo cambios
    if (!nombreCambio && !apellidoCambio) {
      showAlert(
        "info",
        "Sin cambios",
        "No se realizaron cambios en tu perfil."
      );
      return;
    }

    // Preparar mensaje personalizado
    let mensaje;

    if (nombreCambio && apellidoCambio) {
      mensaje = "Nombre y apellido actualizados correctamente.";
    } else if (nombreCambio) {
      mensaje = "Nombre actualizado correctamente.";
    } else {
      mensaje = "Apellido actualizado correctamente.";
    }

    setIsSaving(true);

    try {
      // Actualizar información en Supabase mediante el servicio
      const updatedUser = await updateMyProfile(nombre, apellido);

      setFirstName(updatedUser.nombre);
      setLastName(updatedUser.apellido);

      // Actualizar los datos del componente padre
      onProfileUpdated(updatedUser);

      // Mostrar notificación de éxito
      showAlert(
        "success",
        "Perfil actualizado",
        mensaje
      );

    } catch (err) {
      showAlert(
        "error",
        "Error al actualizar perfil",
        err.message || "No se pudieron guardar los cambios."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="profilePanel">
      <div className="profilePanelHeading">
        <h2><UserRound size={20} />Información personal</h2>
        <p>Administra la información asociada a tu cuenta</p>
      </div>

      <div className="profilePhotoRow"><UserAvatar user={{ name: [user.nombre, user.apellido].filter(Boolean).join(' '), avatarUrl: user.avatarUrl }} className="account-form-avatar" /><div><strong>{[user.nombre, user.apellido].filter(Boolean).join(' ') || 'Tu perfil'}</strong><span>{user.correo}</span><small>{user.avatarUrl ? 'Imagen asociada a tu cuenta' : 'Tu avatar se representa con tus iniciales.'}</small></div></div>

      <div className="profileFormGrid">
        <label>
          Nombre
          <input
            value={firstName}
            name="firstName"
            type="text"
            maxLength={255}
            disabled={isSaving}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>

        <label>
          Apellido
          <input
            value={lastName}
            name="lastName"
            type="text"
            maxLength={255}
            disabled={isSaving}
            onChange={(event) => setLastName(event.target.value)}
          />
        </label>

        <label>
          Correo electrónico
          <div className="profileReadonlyInput">
            <span>{user.correo}</span>
            <LockKeyhole size={15} aria-hidden="true" />
          </div>
        </label>

        <label>
          Rol
          <div className="profileReadonlyInput">
            <span>{user.rol}</span>
            <LockKeyhole size={15} aria-hidden="true" />
          </div>
        </label>

        <label>
          Estado
          <div className="profileReadonlyInput">
            <span>{user.estado}</span>
            <LockKeyhole size={15} aria-hidden="true" />
          </div>
        </label>

        <label>
          Fecha de creación
          <div className="profileReadonlyInput">
            <span>{formattedDate}</span>
            <LockKeyhole size={15} aria-hidden="true" />
          </div>
        </label>
      </div>

      <div className="profileFormActions">
        <button
          className="secondaryButton"
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancelar
        </button>

        <button
          className="primaryButton"
          type="button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </button>

        <button className="passwordButton" type="button" onClick={handleChangePassword}>
          Cambiar contraseña
        </button>
      </div>
      {isSaving && <Loading />}

      <AlertModal
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        variant="toast"
        autoClose={true}
        autoCloseTime={3000}
      />
    </section>
  );
}

export default ProfileForm;