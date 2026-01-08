/**
 * Main UI view: checks API health and shows a status message.
 */
import { useEffect, useMemo, useState } from 'react';

function App() {
  const apiBase = useMemo(() => {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
  }, []);

  const [message, setMessage] = useState('Comprobando salud...');

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiBase}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('API no disponible');
        const payload = await response.json();
        setMessage(`API lista (uptime ${Math.round(payload.uptime)}s)`);
      })
      .catch(() => setMessage('No se pudo contactar la API'));

    return () => controller.abort();
  }, [apiBase]);

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">MERN Starter</p>
        <h1>¡Listo para construir!</h1>
        <p>{message}</p>
        <div className="meta">
          <span>Front: Vite + React + TS</span>
          <span>Back: Express + Mongo</span>
        </div>
      </section>
    </main>
  );
}

export default App;
