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
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
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
    ? ([docente.nombres, docente.apellidos].filter(Boolean).join(' ').trim() || docente.nombreCompleto)
    : 'Modo de acceso';
  return (
    <section className="card anim-entrada shell-docente superficie-app superficie-app--docente">
      <div className="shell-docente__hero">
        <div className="cabecera shell-docente__header">
          <div className="shell-docente__intro">
            <p className="eyebrow">
              <Icono nombre="docente" /> Plataforma Docente
            </p>
            <h1>Banco y Examenes</h1>
            <p className="shell-docente__lead">
              Diseña, opera y publica evaluaciones con una interfaz más clara, sobria y orientada al trabajo docente.
            </p>
          </div>
          <div className="cabecera__acciones shell-docente__acciones">
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
        <div className="shell-docente__metrics" aria-label="Resumen visual del portal docente">
          <article className="shell-docente__metric">
            <span>Espacio</span>
            <strong>Operación académica</strong>
          </article>
          <article className="shell-docente__metric">
            <span>Sesión</span>
            <strong>{nombreSesion}</strong>
          </article>
          <article className="shell-docente__metric">
            <span>Enfoque</span>
            <strong>Banco, OMR y publicación</strong>
          </article>
        </div>
      </div>
      {docente && (
        <InlineMensaje tipo="info">
          Sesion: {nombreSesion} ({docente.correo})
        </InlineMensaje>
      )}
      <div className="shell-docente__content">
        {children}
      </div>
    </section>
  );
}
