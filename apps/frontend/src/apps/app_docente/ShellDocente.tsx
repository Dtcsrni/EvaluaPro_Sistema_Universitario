/**
 * ShellDocente
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Icono } from '../../ui/iconos';
import { TemaBoton } from '../../tema/TemaBoton';
import { Boton } from '../../ui/ux/componentes/Boton';
import { abrirVentanaVersion, obtenerVersionTecnicaApp } from '../../ui/version/versionInfo';
import { EVENTO_FOTO_PERFIL_DOCENTE, obtenerFotoPerfilLocal } from './fotoPerfilDocente';
import type { Docente } from './tipos';

export function ShellDocente({
  docente,
  onCerrarSesion,
  onAbrirCuenta,
  children
}: {
  docente: Docente | null;
  onCerrarSesion: () => void;
  onAbrirCuenta: () => void;
  children: ReactNode;
}) {
  const version = obtenerVersionTecnicaApp();
  const [fotoLocal, setFotoLocal] = useState<string | null>(null);
  const [fotoCuentaFallida, setFotoCuentaFallida] = useState(false);
  const [fotoLocalFallida, setFotoLocalFallida] = useState(false);
  const nombreSesion = docente
    ? ([docente.nombres, docente.apellidos].filter(Boolean).join(' ').trim() || docente.nombreCompleto || (docente as unknown as Record<string, string>).nombre || docente.correo)
    : 'Modo de acceso';

  const fotoCuenta = String(docente?.imagenPerfil || '').trim();
  const fotoCuentaSegura = /^(https:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(fotoCuenta) ? fotoCuenta : '';
  const fotoVisible = fotoCuentaSegura && !fotoCuentaFallida
    ? fotoCuentaSegura
    : fotoLocal && !fotoLocalFallida
      ? fotoLocal
      : null;

  useEffect(() => {
    setFotoLocal(docente?.id ? obtenerFotoPerfilLocal(docente.id) : null);
    setFotoCuentaFallida(false);
    setFotoLocalFallida(false);
  }, [docente?.id, fotoCuentaSegura]);

  useEffect(() => {
    const actualizarFoto = (evento: Event) => {
      const detalle = (evento as CustomEvent<{ docenteId?: string; foto?: string | null }>).detail;
      if (detalle?.docenteId === docente?.id) {
        setFotoLocal(detalle.foto || null);
        setFotoLocalFallida(false);
      }
    };
    window.addEventListener(EVENTO_FOTO_PERFIL_DOCENTE, actualizarFoto);
    return () => window.removeEventListener(EVENTO_FOTO_PERFIL_DOCENTE, actualizarFoto);
  }, [docente?.id]);

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
            <button
              type="button"
              className="chip chip-docente-sesion"
              data-tooltip="Abrir perfil docente y preferencias"
              aria-label={`Abrir perfil docente de ${nombreSesion}`}
              onClick={onAbrirCuenta}
            >
              <span className="chip-docente-avatar" aria-hidden="true">
                {fotoVisible ? (
                  <img
                    src={fotoVisible}
                    alt=""
                    onError={() => {
                      if (fotoCuentaSegura && fotoVisible === fotoCuentaSegura) setFotoCuentaFallida(true);
                      else setFotoLocalFallida(true);
                    }}
                  />
                ) : <Icono nombre="cuenta" size={25} />}
                <span className="chip-docente-avatar__status" />
              </span>
              <span className="chip-docente-copy">
                <span className="chip-docente-name">{nombreSesion}</span>
                <span className="chip-docente-role">Docente</span>
              </span>
              <Icono nombre="chevron" size={18} className="chip-docente-chevron" />
            </button>
          )}
          <div className="shell-docente__controles">
            <button
              type="button"
              className="chip chip-version"
              aria-label={`Versión ${version}`}
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
      </div>
      <div className="shell-docente__content">
        {children}
      </div>
    </section>
  );
}
