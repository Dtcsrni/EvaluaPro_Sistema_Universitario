const destinosRevisionCaptura = [
  { href: '#calificaciones-omr-heading', label: 'Escaneo y revisión OMR' },
  { href: '#calificaciones-manual-selection-heading', label: 'Calificación manual' },
  { href: '#calificaciones-encuadre-heading', label: 'Encuadre académico' },
  { href: '#calificaciones-aclaraciones-heading', label: 'Solicitudes de revisión' }
];

export function NavegacionRevisionCaptura() {
  return (
    <nav className="calificaciones-task-nav" aria-label="Accesos directos de Revisión y captura">
      <p className="calificaciones-task-nav__label">Ir directamente a:</p>
      <ul className="calificaciones-task-nav__links">
        {destinosRevisionCaptura.map(({ href, label }) => (
          <li key={href}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
