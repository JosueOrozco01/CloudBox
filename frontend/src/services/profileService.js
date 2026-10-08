const API_URL = "http://localhost:3000/api/users";

export const getMyProfile = async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await fetch(`${API_URL}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al obtener el perfil");
  }

  return data.data;
};

export const updateMyProfile = async (nombre, apellido) => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await fetch(
    "http://localhost:3000/api/users/me",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ nombre, apellido }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "No se pudo actualizar el perfil");
  }

  return data.data;
};

export const getMyStorage = async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await fetch(
    "http://localhost:3000/api/users/me/storage",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "No se pudo obtener el almacenamiento"
    );
  }

  return data.data;
};

export const deactivateMyAccount = async (password) => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await fetch(
    "http://localhost:3000/api/users/me/deactivate",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "No se pudo desactivar la cuenta"
    );
  }

  return data;
};