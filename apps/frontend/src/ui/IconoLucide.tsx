import type { LucideIcon } from 'lucide-react';

type BaseProps = {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export type PropsIconoLucide = BaseProps & (
  | { decorative?: true; label?: never }
  | { decorative: false; label: string }
);

/** Adapta cualquier icono del catálogo Lucide a las convenciones accesibles de EvaluaPro. */
export function IconoLucide({
  icon: Icon,
  size = 18,
  strokeWidth = 2,
  className = 'icono icono-lucide',
  decorative = true,
  label
}: PropsIconoLucide) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      focusable={false}
      aria-hidden={decorative}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    />
  );
}
