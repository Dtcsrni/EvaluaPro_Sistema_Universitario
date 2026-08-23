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

  return (
    <section className="card anim-entrada shell-docente superficie-app superficie-app--docente">
      <div className="cabecera shell-docente__header">
        <div className="shell-docente__intro">
          <div className="shell-docente__brand-row">
            <span className="shell-docente__logo-icon">
              <Icono nombre="docente" />
            </span>
            <div>
              <p className="eyebrow">EvaluaPro · Sistema Universitario</p>
              <h1>Plataforma Docente</h1>
            </div>
          </div>
        </div>
        <div className="cabecera__acciones shell-docente__acciones">
          {docente && (
            <span className="chip chip-docente-sesion" title={`Sesión activa: ${docente.correo}`}>
              <Icono nombre="docente" /> {nombreSesion}
            </span>
          )}
          <button
            type="button"
            className="chip chip-version"
            title="Abrir información de versión"
            onClick={() => abrirVentanaVersion('docente')}
          >
            v{version}
          </button>
          <TemaBoton />
          {docente && (
            <Boton variante="secundario" type="button" icono={<Icono nombre="salir" />} onClick={onCerrarSesion}>
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
