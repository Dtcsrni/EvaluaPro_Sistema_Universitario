/**
 * ShellDocente
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { ReactNode } from 'react';
import { Icono } from '../../ui/iconos';
import { TemaBoton } from '../../tema/TemaBoton';
import { Boton } from '../../ui/ux/componentes/Boton';
import { abrirVentanaVersion, obtenerVersionApp } from '../../ui/version/versionInfo';
import type { Docente } from './tipos';

export function ShellDocente({
  docente,
  onCerrarSesion,
  children
}: {
  docente: Docente | null;
  onCerrarSesion: () => void;
  children: ReactNode;
}) {
  const version = obtenerVersionApp();
  const nombreSesion = docente
    ? ([docente.nombres, docente.apellidos].filter(Boolean).join(' ').trim() || docente.nombreCompleto || (docente as unknown as Record<string, string>).nombre || docente.correo)
    : 'Modo de acceso';

  const iniciales = docente
    ? [docente.nombres?.[0], docente.apellidos?.[0]].filter(Boolean).join('').toUpperCase() || 'EP'
    : 'DOC';

  return (
    <section className="card anim-entrada shell-docente superficie-app superficie-app--docente">
      <div className="cabecera shell-docente__header">
        <div className="shell-docente__intro">
          <div className="shell-docente__brand-row">
            <span className="shell-docente__logo-icon">
              <img src="/favicon-docente.svg" alt="EvaluaPro" className="shell-docente__brand-img" />
            </span>
            <div>
              <p className="eyebrow">EvaluaPro · Sistema Universitario</p>
              <h1 className="shell-docente__title">Plataforma Docente</h1>
            </div>
          </div>
        </div>
        <div className="cabecera__acciones shell-docente__acciones">
          {docente && (
            <div
              className="chip chip-docente-sesion"
              data-tooltip={`Docente: ${nombreSesion} (${docente.correo})`}
              title={`Docente: ${nombreSesion} (${docente.correo})`}
            >
              <span className="chip-docente-avatar">{iniciales}</span>
              <span className="chip-docente-name">{nombreSesion}</span>
            </div>
          )}
          <button
            type="button"
            className="chip chip-version"
            data-tooltip="Abrir información de versión, tecnologías y changelog"
            title="Abrir información de versión, tecnologías y changelog"
            onClick={() => abrirVentanaVersion('docente')}
          >
            v{version}
          </button>
          <TemaBoton />
          {docente && (
            <Boton
              variante="secundario"
              type="button"
              icono={<Icono nombre="salir" />}
              onClick={onCerrarSesion}
              data-tooltip="Cerrar sesión de forma segura en este equipo"
              title="Cerrar sesión de forma segura en este equipo"
            >
              Salir
            </Boton>
          )}
        </div>
      </div>
      <div className="shell-docente__content">
        {children}
      </div>
    </section>
  );
}
