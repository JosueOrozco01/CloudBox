import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const token = localStorage.getItem("token");
    const refreshToken = localStorage.getItem("refreshToken");

    try {
        const response = await fetch("http://localhost:3000/api/auth/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                accessToken: token,
                refreshToken: refreshToken
            })
        });

        const data = await response.json();

        console.log("Logout:", data);

    } catch (error) {
        console.error("Error al cerrar sesión:", error);

    } finally {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");

        navigate("/login");
    }
};

  return (
    <div className="dashboard-page">
      <header className="dashboard-topbar">
        <span className="dashboard-brand">CloudBox</span>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <main className="dashboard-content">
        <h1>Bienvenido a tu Dashboard</h1>
        <p>Aquí va el contenido de tu aplicación.</p>
      </main>
    </div>
  );
}