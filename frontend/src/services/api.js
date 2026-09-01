const API_URL = "http://localhost:3000/api";

export async function testConnection() {
  const response = await fetch(`${API_URL}/test`);

  if (!response.ok) {
    throw new Error("Error al conectar con el servidor");
  }

  return response.json();
}