import {
  BookOpen,
  CalendarDays,
  IdCard,
  KeyRound,
  LibraryBig,
  Mail,
  Search,
  ShieldCheck,
  Tags,
  UserRound,
  UsersRound,
  type LucideIcon
} from 'lucide-react';
import { normalizarTamanoIcono } from './iconos';

export type TipoIconoCampo = 'user' | 'mail' | 'shield' | 'key' | 'book' | 'calendar' | 'tags' | 'select' | 'group' | 'search' | 'id';

const ICONOS_CAMPO: Record<TipoIconoCampo, LucideIcon> = {
  user: UserRound,
  mail: Mail,
  shield: ShieldCheck,
  key: KeyRound,
  book: BookOpen,
  calendar: CalendarDays,
  tags: Tags,
  select: LibraryBig,
  group: UsersRound,
  search: Search,
  id: IdCard
};

type BaseProps = {
  icon: LucideIcon;
  size?: number;
  className?: string;
};

export type PropsIconoLucide = BaseProps & (
  | { decorative?: true; label?: never }
  | { decorative: false; label: string }
);

/** Adapta cualquier icono del catálogo Lucide a las convenciones accesibles de EvaluaPro. */
export function IconoLucide({
  icon: Icon,
  size = 20,
  className,
  decorative = true,
  label
}: PropsIconoLucide) {
  return (
    <Icon
      size={normalizarTamanoIcono(size)}
      strokeWidth={2}
      className={['icono', 'icono-lucide', className].filter(Boolean).join(' ')}
      focusable={false}
      aria-hidden={decorative}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    />
  );
}

/** Icono decorativo para campos con semántica reconocible y estilo compartido. */
export function IconoCampo({ nombre }: { nombre: TipoIconoCampo }) {
  return (
    <span className="auth-input-box__icon" aria-hidden="true">
      <IconoLucide icon={ICONOS_CAMPO[nombre]} size={16} />
    </span>
  );
}
