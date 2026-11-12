/** Sistema compartido de iconos de producto de EvaluaPro. */
import {
  BookOpenText, CalendarCheck, CalendarDays, ChartNoAxesColumnIncreasing, ChevronDown, ChevronUp, CircleCheck,
  CirclePlus, CircleUserRound, ClipboardCheck, ClipboardList, Copy, Download,
  Eye, EyeOff, FileText, GraduationCap, History, House, Inbox, Info, LibraryBig, ListTree, LoaderCircle, LockKeyhole,
  LogIn, LogOut, Mail, MessageCircleQuestion, Pencil, QrCode, RefreshCw, ScanLine, Search, School,
  Trash2, TriangleAlert, Upload, UserRound, UsersRound, type LucideIcon
} from 'lucide-react';

export const NOMBRES_ICONO = [
  'inicio', 'periodos', 'alumnos', 'banco', 'plantillas', 'recepcion', 'escaneo', 'calificar',
    'evaluaciones', 'publicar', 'alumno', 'docente', 'salir', 'entrar', 'recargar', 'pdf', 'nuevo', 'chevron', 'chevronAbajo', 'chevronArriba',
  'ok', 'alerta', 'info', 'aclaraciones', 'buscar', 'editar', 'eliminar', 'copiar', 'descargar', 'candado',
  'ojo', 'ojoCerrado', 'correo', 'qr', 'asistencias', 'temarios', 'classroom', 'sincronizacion', 'cuenta', 'agenda', 'historial'
] as const;

export type NombreIcono = typeof NOMBRES_ICONO[number];
export const TAMANOS_ICONO = [14, 16, 20, 24, 28, 32] as const;

export function normalizarTamanoIcono(size?: number) {
  const valor = Number.isFinite(size) ? size! : 20;
  if (valor < 14) return 14;
  if (valor > 32) return Math.max(32, Math.round(valor / 4) * 4);
  return TAMANOS_ICONO.reduce((cercano, candidato) =>
    Math.abs(candidato - valor) <= Math.abs(cercano - valor) ? candidato : cercano, 14);
}

const ICONOS_PRODUCTO: Record<NombreIcono, LucideIcon> = {
  inicio: House,
  periodos: BookOpenText,
  alumnos: UsersRound,
  banco: LibraryBig,
  plantillas: ClipboardList,
  recepcion: Inbox,
  escaneo: ScanLine,
  calificar: ClipboardCheck,
  evaluaciones: ChartNoAxesColumnIncreasing,
  publicar: Upload,
  alumno: UserRound,
  docente: GraduationCap,
  salir: LogOut,
  entrar: LogIn,
  recargar: RefreshCw,
  pdf: FileText,
  nuevo: CirclePlus,
  chevron: ChevronDown,
  chevronAbajo: ChevronDown,
  chevronArriba: ChevronUp,
  ok: CircleCheck,
  alerta: TriangleAlert,
  info: Info,
  aclaraciones: MessageCircleQuestion,
  buscar: Search,
  editar: Pencil,
  eliminar: Trash2,
  copiar: Copy,
  descargar: Download,
  candado: LockKeyhole,
  ojo: Eye,
  ojoCerrado: EyeOff,
  correo: Mail,
  qr: QrCode,
  asistencias: CalendarCheck,
  temarios: ListTree,
  classroom: School,
  sincronizacion: RefreshCw,
  cuenta: CircleUserRound,
  agenda: CalendarDays,
  historial: History
};

type PropsIcono = {
  nombre: NombreIcono;
  size?: number;
  className?: string;
  title?: string;
  ariaHidden?: boolean;
};

/** Conserva la API de producto y renderiza con la misma familia Lucide que IconoLucide. */
export function Icono({ nombre, size, className, title, ariaHidden = true }: PropsIcono) {
  const Icon = ICONOS_PRODUCTO[nombre];
  const visible = !ariaHidden;
  return (
    <Icon
      size={normalizarTamanoIcono(size)}
      strokeWidth={2}
      className={['icono', className].filter(Boolean).join(' ')}
      focusable={false}
      aria-hidden={!visible}
      role={visible ? 'img' : undefined}
      aria-label={visible ? (title || 'icono') : undefined}
      data-icono={nombre}
    />
  );
}

export function Spinner({ size = 20, className = 'spinner' }: { size?: number; className?: string }) {
  const tamano = normalizarTamanoIcono(size);
  return (
    <LoaderCircle
      size={tamano}
      strokeWidth={2}
      className={`icono ${className}`}
      focusable={false}
      aria-hidden="true"
      data-icono="spinner"
    />
  );
}

export function IlustracionSinResultados({ className = 'ilustracion' }: { className?: string }) {
  return (
    <svg
      className={className}
      data-illustration="no-results"
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
