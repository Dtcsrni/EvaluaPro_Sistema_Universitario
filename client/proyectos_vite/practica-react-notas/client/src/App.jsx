import { useEffect, useState } from "react";  
const URL_API = import.meta.env.VITE_URL_API;

export default function App() {
  const [notas, setNotas] = useState([]);
  const [texto, setTexto] = useState("");

  //GET trae notas y las guarda en el estado
  const cargarNotas = async () => {
    const res = await fetch(`${URL_API}/api/notas`);
    const datos = await res.json();
    setNotas(datos);
  };
  //POST enviar texto y luego recargar lista
  const guardarNota = async (e) => {
    e.preventDefault();
    try {
    await fetch(`${URL_API}/api/notas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    console.log("Nota guardada", texto);
    } catch (error) {
      console.error("Error al guardar la nota:", error);
    }

    setTexto("");
    cargarNotas();
  }

  //Logica al iniciar la página para cargar notas

  useEffect(() => {
    cargarNotas();
  }, []);
  
  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "20px", fontFamily: "system-ui" }}>
      <h1>Notas</h1>
      <form onSubmit={guardarNota} style={{ display: "flex", marginBottom: "20px", gap: "10px" }}>

        <input 
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe una nota"
        style={{ flex: 1, padding: "10px", fontSize: "16px" }}
        />
        <button style={{ padding: "10px 20px", fontSize: "16px" }}>Guardar Nota</button>
      </form>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {notas.map((nota) => (
          <li key={nota._id} style={{ background: "#452626", padding: "10px", marginBottom: "10px", borderRadius: "5px", color: "#fff" }}>
            {nota.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}