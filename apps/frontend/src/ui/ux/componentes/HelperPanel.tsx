/**
 * Panel de ayuda contextual reusable para guiar flujos clave.
 *
 * Uso recomendado:
 * - Titulos orientados a tarea.
 * - Pasos cortos y accionables.
 * - Mostrar en puntos donde el usuario toma decisiones criticas.
 */
import type { ReactNode } from 'react';
import { Icono } from '../../iconos';

export function HelperPanel({
  titulo,
  descripcion,
  pasos,
  notas
}: {
  titulo: string;
  descripcion: string;
  pasos: string[];
  notas?: ReactNode;
}) {
  const pasosSeguros = Array.isArray(pasos) ? pasos.filter(Boolean) : [];
  return (
    <aside className="panel helper-panel" aria-label={`Ayuda: ${titulo}`}>
      <div className="helper-panel__header">
        <p className="eyebrow">
          <Icono nombre="info" /> Guia rapida
        </p>
        <h3>{titulo}</h3>
        <p className="nota">{descripcion}</p>
      </div>
      {pasosSeguros.length > 0 && (
        <ol className="helper-panel__pasos">
          {pasosSeguros.map((paso, indice) => (
            <li key={paso}>
              <span className="helper-panel__stepIndex" aria-hidden="true">{String(indice + 1).padStart(2, '0')}</span>
              <span>{paso}</span>
            </li>
          ))}
        </ol>
      )}
      {notas ? <div className="helper-panel__notas">{notas}</div> : null}
    </aside>
  );
}
