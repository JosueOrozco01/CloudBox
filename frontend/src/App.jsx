import { useEffect, useState } from "react";
import { testConnection } from "./services/api";

function App() {
  const [message, setMessage] = useState("Conectando...");

  useEffect(() => {
    testConnection()
      .then((data) => {
        setMessage(data.message);
      })
      .catch(() => {
        setMessage("No se pudo conectar con el backend");
      });
  }, []);

  return (
    <div>
      <h1>CloudBox</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;