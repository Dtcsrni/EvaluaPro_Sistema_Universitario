/**
 * iconos
 *
 * Responsabilidad: Sistema integral de iconos SVG de alta definición para EvaluaPro.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
import type { ReactNode } from 'react';

export type NombreIcono =
  | 'inicio'
  | 'periodos'
  | 'alumnos'
  | 'banco'
  | 'plantillas'
  | 'recepcion'
  | 'escaneo'
  | 'calificar'
  | 'publicar'
  | 'alumno'
  | 'docente'
  | 'salir'
  | 'entrar'
  | 'recargar'
  | 'pdf'
  | 'nuevo'
  | 'chevron'
  | 'ok'
  | 'alerta'
  | 'info'
  | 'buscar'
  | 'editar'
  | 'eliminar'
  | 'copiar'
  | 'descargar'
  | 'candado'
  | 'correo'
  | 'qr'
  | 'asistencias'
  | 'temarios'
  | 'evaluaciones'
  | 'classroom'
  | 'sincronizacion'
  | 'cuenta';

type PropsIcono = {
  nombre: NombreIcono;
  size?: number;
  className?: string;
  title?: string;
  ariaHidden?: boolean;
};

function SvgBase({
  children,
  size = 20,
  className,
  title,
  ariaHidden = true,
  viewBox = '0 0 24 24',
  dataIcono
}: {
  children: ReactNode;
  size?: number;
  className?: string;
  title?: string;
  ariaHidden?: boolean;
  viewBox?: string;
  dataIcono?: string;
}) {
  const a11y = ariaHidden
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': title || 'icono' } as const);

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      data-icono={dataIcono}
      {...a11y}
    >
      {title && !ariaHidden ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function Icono(props: PropsIcono) {
  const { nombre, size, className = 'icono', title, ariaHidden } = props;
  const common = { size, className, title, ariaHidden, dataIcono: nombre };

  switch (nombre) {
    case 'inicio':
      return (
        <SvgBase {...common}>
          <path d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'periodos':
      return (
        <SvgBase {...common}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 6h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M6 10h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M6 14h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M16 2v6l2-1.5 2 1.5V2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'alumnos':
      return (
        <SvgBase {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'banco':
      return (
        <SvgBase {...common}>
          <rect width="18" height="18" x="3" y="3" rx="3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 13.5V15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="17.5" r="0.75" fill="currentColor" />
          <line x1="7" y1="7" x2="7" y2="7.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="17" y1="7" x2="17" y2="7.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </SvgBase>
      );

    case 'plantillas':
      return (
        <SvgBase {...common}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="14 2 14 7 20 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8.5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="15.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8.5" cy="16" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" />
          <circle cx="15.5" cy="16" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        </SvgBase>
      );

    case 'recepcion':
      return (
        <SvgBase {...common}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="3" x2="12" y2="9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <polyline points="9 6 12 9 15 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'escaneo':
      return (
        <SvgBase {...common}>
          <path d="M3 7V5a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        </SvgBase>
      );

    case 'calificar':
      return (
        <SvgBase {...common}>
          <rect width="16" height="19" x="4" y="2.5" rx="2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 7l2 2 5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </SvgBase>
      );

    case 'evaluaciones':
      return (
        <SvgBase {...common}>
          <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 20h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <polyline points="4 9 9 4 14 9 20 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'publicar':
    case 'sincronizacion':
      return (
        <SvgBase {...common}>
          <path d="M21.5 2v6h-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2.5 22v-6h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 11.5A10 10 0 0 0 3.2 7.2L2.5 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 12.5a10 10 0 0 0 18.8 4.3l.7-.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'cuenta':
      return (
        <SvgBase {...common}>
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'docente':
      return (
        <SvgBase {...common}>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'alumno':
      return (
        <SvgBase {...common}>
          <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 21a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'salir':
      return (
        <SvgBase {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'entrar':
      return (
        <SvgBase {...common}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="10 17 15 12 10 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="15" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'recargar':
      return (
        <SvgBase {...common}>
          <path d="M3 12a9 9 0 0 1 15.54-6.36L21 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="21 3 21 8 16 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12a9 9 0 0 1-15.54 6.36L3 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="3 21 3 16 8 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'nuevo':
      return (
        <SvgBase {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'pdf':
      return (
        <SvgBase {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 13v4M9 13h2a1.5 1.5 0 0 0 0-3H9M14 10v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </SvgBase>
      );

    case 'chevron':
      return (
        <SvgBase {...common}>
          <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'ok':
      return (
        <SvgBase {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="8.5 12 11 14.5 15.5 9.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'alerta':
      return (
        <SvgBase {...common}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'info':
      return (
        <SvgBase {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'buscar':
      return (
        <SvgBase {...common}>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'editar':
      return (
        <SvgBase {...common}>
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'eliminar':
      return (
        <SvgBase {...common}>
          <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'copiar':
      return (
        <SvgBase {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'descargar':
      return (
        <SvgBase {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'candado':
      return (
        <SvgBase {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'correo':
      return (
        <SvgBase {...common}>
          <rect width="20" height="16" x="2" y="4" rx="2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'qr':
      return (
        <SvgBase {...common}>
          <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2.2" />
          <rect x="15" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2.2" />
          <rect x="3" y="15" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2.2" />
          <path d="M15 15h2v2h-2zM19 15h2v6h-2zM15 19h2v2h-2z" fill="currentColor" />
        </SvgBase>
      );

    case 'asistencias':
      return (
        <SvgBase {...common}>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'temarios':
      return (
        <SvgBase {...common}>
          <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </SvgBase>
      );

    case 'classroom':
      return (
        <SvgBase {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="13" cy="9" r="2.5" stroke="currentColor" strokeWidth="2.2" />
          <path d="M9 14.5c0-1.8 1.8-2.5 4-2.5s4 .7 4 2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </SvgBase>
      );

    default:
      return null;
  }
}

export function Spinner({ size = 18, className = 'spinner' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      data-icono="spinner"
      aria-hidden="true"
    >
      <path
        d="M12 4a8 8 0 1 0 8 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IlustracionSinResultados({ className = 'ilustracion' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="320" y2="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c7d2fe" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      <rect x="10" y="20" width="300" height="120" rx="18" fill="url(#g)" opacity="0.75" />
      <path d="M78 104c18-26 46-40 82-40 28 0 52 10 70 28" stroke="#1e40af" strokeWidth="8" strokeLinecap="round" opacity="0.65" />
      <path d="M110 108h100" stroke="#0f172a" strokeWidth="8" strokeLinecap="round" opacity="0.35" />
      <circle cx="74" cy="74" r="22" fill="#ffffff" opacity="0.7" />
      <circle cx="250" cy="92" r="18" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}
