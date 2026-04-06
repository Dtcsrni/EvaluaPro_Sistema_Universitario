/**
 * AyudaFormulario
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { ReactNode } from 'react';
import { Icono } from '../../ui/iconos';

export function AyudaFormulario({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="panel ayuda-formulario">
      <div className="ayuda-formulario__header">
        <h3 className="ayuda-formulario__title">
          <span className="ayuda-formulario__icon">
            <Icono nombre="info" />
          </span>
          <span>{titulo}</span>
        </h3>
        <div className="ayuda-formulario__chips" aria-hidden="true">
          <span className="ayuda-chip">
            <Icono nombre="ok" /> Paso
          </span>
          <span className="ayuda-chip">
            <Icono nombre="info" /> Tip
          </span>
          <span className="ayuda-chip">
            <Icono nombre="alerta" /> Validación
          </span>
        </div>
      </div>
      <div className="nota ayuda-formulario__body">{children}</div>
    </div>
  );
}
