import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Práctica: Sistemas Visuales (React + TypeScript)
 * Todo en un solo archivo para que sea fácil de estudiar.
 */
export default function App() {
  // =========================
  // 1) ESTADO (useState)
  // =========================
  // Caja de texto (input) -> Formulario controlado: el valor vive en estado
  const [nombre, setNombre] = useState<string>('');
  const [matricula, setMatricula] = useState<string>('');

  // Radio buttons -> seleccion única (solo un valor)
  const [turno, setTurno] = useState<'matutino' | 'vespertino'>('matutino');

  // Checkbox -> booleano (activado/desactivado)
  const [aceptaTerminos, setAceptaTerminos] = useState<boolean>(false);

  // Lista desplegable (select)
  const [carrera, setCarrera] = useState<string>('ISC');

  // Menú (simulado): qué sección estás viendo
  const [seccion, setSeccion] = useState<'registro' | 'ayuda'>('registro');

  // Temporizador y barra de progreso (simulación)
  const [progreso, setProgreso] = useState<number>(0);
  const [corriendo, setCorriendo] = useState<boolean>(false);

  // “Ventana”: guardamos tamaño actual
  const [windowSize, setWindowSize] = useState<{ w: number; h: number }>({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  // Referencia para enfocar una caja de texto (ejemplo básico de interacción con DOM)
  const nombreRef = useRef<HTMLInputElement | null>(null);

  // =========================
  // 2) EVENTOS DE VENTANA (Window)
  // =========================
  useEffect(() => {
    /**
     * Evento de ventana: resize
     * React normalmente maneja eventos en componentes, pero “window” es global.
     */
    const onResize = () => {
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    };

    /**
     * Evento de ventana: beforeunload
     * Solo para demostrar: advertir al salir si hay texto escrito.
     * Nota: navegadores modernos limitan el texto personalizado.
     */
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const hayDatos = nombre.trim() !== '' || matricula.trim() !== '';
      if (!hayDatos) return;

      e.preventDefault();
      e.returnValue = ''; // requerido para que el navegador muestre diálogo
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('beforeunload', onBeforeUnload);

    // Cleanup: se ejecuta al desmontar el componente (buena práctica)
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [nombre, matricula]);

  // =========================
  // 3) TEMPORIZADOR (Timer) + PROGRESS BAR
  // =========================
  useEffect(() => {
    if (!corriendo) return;

    /**
     * setInterval simula un temporizador que aumenta un progreso.
     * Guardamos el id para poder detenerlo en cleanup.
     */
    const id = window.setInterval(() => {
      setProgreso((prev) => {
        const next = prev + 10;
        return next >= 100 ? 100 : next;
      });
    }, 500);

    // Detener interval al salir o cuando corriendo cambie
    return () => window.clearInterval(id);
  }, [corriendo]);

  // Cuando llega a 100, detenemos automáticamente
  useEffect(() => {
    if (progreso >= 100) setCorriendo(false);
  }, [progreso]);

  // =========================
  // 4) VALIDACIONES DERIVADAS (useMemo)
  // =========================
  const formularioValido = useMemo(() => {
    // Validación mínima: campos obligatorios + términos
    return (
      nombre.trim().length >= 3 &&
      matricula.trim().length >= 6 &&
      aceptaTerminos
    );
  }, [nombre, matricula, aceptaTerminos]);

  // =========================
  // 5) ACCIONES (eventos de botón / teclado / formulario)
  // =========================
  const limpiar = () => {
    setNombre('');
    setMatricula('');
    setTurno('matutino');
    setAceptaTerminos(false);
    setCarrera('ISC');
    setProgreso(0);
    setCorriendo(false);

    // Enfocar el input de nombre para UX
    nombreRef.current?.focus();
  };

  const validarYRegistrar = (e?: React.FormEvent) => {
    // Si viene desde form submit, evitamos recargar página
    e?.preventDefault();

    // Caja de diálogo (confirmación)
    if (!formularioValido) {
      alert('Formulario incompleto: revisa campos y acepta términos.');
      return;
    }

    const ok = confirm(
      `¿Registrar alumno?\n\nNombre: ${nombre}\nMatrícula: ${matricula}\nCarrera: ${carrera}\nTurno: ${turno}`
    );

    if (!ok) return;

    alert('Registro exitoso (simulado).');

    // Simulamos proceso con barra
    setProgreso(0);
    setCorriendo(true);
  };

  // =========================
  // 6) UI: “Menú”
  // =========================
  const Menu = (
    <nav style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      {/* Menú: botones que cambian "seccion" */}
      <button onClick={() => setSeccion('registro')}>
        Registro
      </button>
      <button onClick={() => setSeccion('ayuda')}>
        Ayuda
      </button>
      <span style={{ marginLeft: 'auto', opacity: 0.75 }}>
        Ventana: {windowSize.w}×{windowSize.h}
      </span>
    </nav>
  );

  // =========================
  // 7) UI: “Etiqueta e imagen”
  // =========================
  const Header = (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      {/* Imagen: usamos un SVG inline simple para no depender de archivos */}
      <svg width="42" height="42" viewBox="0 0 64 64" aria-label="Logo">
        <circle cx="32" cy="32" r="30" />
        <text x="32" y="38" textAnchor="middle" fontSize="18" fill="white">
          SV
        </text>
      </svg>

      {/* Etiqueta (Label) */}
      <div>
        <h1 style={{ margin: 0 }}>Módulo de Registro (Sistemas Visuales)</h1>
        <p style={{ margin: 0, opacity: 0.75 }}>
          Componentes básicos + eventos (React + TypeScript)
        </p>
      </div>
    </header>
  );

  // =========================
  // 8) SECCIONES (render condicional)
  // =========================
  const SeccionAyuda = (
    <section style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
      <h2>Ayuda</h2>
      <ul>
        <li><b>Botones</b>: cambian estado y ejecutan acciones.</li>
        <li><b>Cajas de texto</b>: son controladas por estado.</li>
        <li><b>Radio</b>: elección única.</li>
        <li><b>Checkbox</b>: verdadero/falso.</li>
        <li><b>Select</b>: lista desplegable.</li>
        <li><b>Diálogo</b>: confirmación con <code>confirm()</code>.</li>
        <li><b>Temporizador</b>: <code>setInterval</code> simula avance.</li>
        <li><b>Ventana</b>: evento <code>resize</code> actualiza dimensiones.</li>
      </ul>
    </section>
  );

  const SeccionRegistro = (
    /**
     * Frame + Form:
     * - “Frame”: contenedor visual (section con borde)
     * - “Form”: etiqueta <form> con submit
     */
    <section style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
      <h2>Registro</h2>

      <form onSubmit={validarYRegistrar}>
        {/* Caja de texto (TextBox) */}
        <div style={{ marginBottom: 10 }}>
          <label>
            Nombre (mínimo 3 chars):
            <br />
            <input
              ref={nombreRef}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez"
            />
          </label>
        </div>

        {/* Caja de texto (TextBox) */}
        <div style={{ marginBottom: 10 }}>
          <label>
            Matrícula (mínimo 6 chars):
            <br />
            <input
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              placeholder="Ej. 202512"
              // Evento de teclado: Enter en el form ya hace submit,
              // pero mostramos cómo se capturan teclas si se requiere.
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  // Escape limpia rápido (ejemplo de evento de teclado)
                  limpiar();
                }
              }}
            />
          </label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Tip: presiona <b>Escape</b> para limpiar.
          </div>
        </div>

        {/* Lista desplegable (ComboBox/Select) */}
        <div style={{ marginBottom: 10 }}>
          <label>
            Carrera:
            <br />
            <select value={carrera} onChange={(e) => setCarrera(e.target.value)}>
              <option value="ISC">Ingeniería en Sistemas</option>
              <option value="ITI">Tecnologías de la Información</option>
              <option value="IG">Ingeniería Industrial</option>
            </select>
          </label>
        </div>

        {/* Radio button (selección única) */}
        <div style={{ marginBottom: 10 }}>
          <div>Turno:</div>
          <label style={{ marginRight: 10 }}>
            <input
              type="radio"
              name="turno"
              checked={turno === 'matutino'}
              onChange={() => setTurno('matutino')}
            />
            Matutino
          </label>
          <label>
            <input
              type="radio"
              name="turno"
              checked={turno === 'vespertino'}
              onChange={() => setTurno('vespertino')}
            />
            Vespertino
          </label>
        </div>

        {/* Checkbox */}
        <div style={{ marginBottom: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
            />
            Acepto términos
          </label>
        </div>

        {/* Botones (Button) */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button type="submit" disabled={!formularioValido}>
            Registrar
          </button>

          <button type="button" onClick={limpiar}>
            Limpiar
          </button>
        </div>

        {/* Validación (render condicional) */}
        {!formularioValido && (
          <p style={{ color: 'crimson', marginTop: 0 }}>
            Completa: nombre (≥3), matrícula (≥6) y acepta términos.
          </p>
        )}
      </form>

      {/* Temporizador + barra de progreso */}
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 6 }}>
          Proceso (simulado): {progreso}%
        </div>

        <div
          style={{
            height: 14,
            borderRadius: 999,
            border: '1px solid #999',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progreso}%`,
              height: '100%',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              setProgreso(0);
              setCorriendo(true);
            }}
          >
            Iniciar
          </button>

          <button
            type="button"
            onClick={() => setCorriendo(false)}
            disabled={!corriendo}
          >
            Pausar
          </button>

          <button
            type="button"
            onClick={() => {
              setCorriendo(false);
              setProgreso(0);
            }}
          >
            Reiniciar
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div style={{ padding: 16 }}>
      {Header}
      {Menu}

      {/* Render condicional de secciones (simula “ventanas” o “pantallas”) */}
      {seccion === 'registro' ? SeccionRegistro : SeccionAyuda}
    </div>
  );
}
