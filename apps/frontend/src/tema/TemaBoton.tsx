/**
 * TemaBoton
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { useMemo } from 'react';
import { Monitor, Moon, Sun, IconoLucide } from '../ui/iconosCatalogo';
import { siguientePreferenciaTema, type PreferenciaTema } from './tema';
import { useTema } from './TemaProvider';

function IconoTema({ modo }: { modo: PreferenciaTema }) {
  const icon = modo === 'dark' ? Moon : modo === 'light' ? Sun : Monitor;
  return <IconoLucide icon={icon} size={20} />;
}

export function TemaBoton({ className }: { className?: string }) {
  const { preferencia, setPreferencia, temaAplicado } = useTema();

  const texto = useMemo(() => {
    if (preferencia === 'auto') return `Tema: Auto (${temaAplicado === 'dark' ? 'Oscuro' : 'Claro'})`;
    return preferencia === 'dark' ? 'Tema: Oscuro' : 'Tema: Claro';
  }, [preferencia, temaAplicado]);

  return (
    <button
      type="button"
      className={[
        'boton',
        'secundario',
        'boton--tema',
        className || ''
      ]
        .filter(Boolean)
        .join(' ')}
      title="Cambiar tema (Auto / Claro / Oscuro)"
      aria-label={texto}
      onClick={() => setPreferencia(siguientePreferenciaTema(preferencia))}
    >
      <IconoTema modo={preferencia} />
      <span className="boton--temaTexto">{texto}</span>
    </button>
  );
}
