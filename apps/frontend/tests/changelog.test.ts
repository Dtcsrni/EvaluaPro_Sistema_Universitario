/**
 * changelog.test
 *
 * Responsabilidad: proteger la lectura estructurada del historial de versiones.
 */
import { describe, expect, it } from 'vitest';
import { formatearFechaChangelog, parsearChangelog } from '../src/ui/version/changelog';

describe('changelog', () => {
  it('convierte Keep a Changelog en versiones y grupos legibles', () => {
    const resultado = parsearChangelog(`
# Changelog
## [Unreleased] - 2026-09-22
### Added
- **Nuevo módulo** para asistencia.
### Fixed - UX
- Se corrigió el foco.
## [1.0.0] - 2026-06-23
### Security
- Se validó la sesión.
`);

    expect(resultado).toEqual([
      {
        version: 'Unreleased',
        fecha: '2026-09-22',
        grupos: [
          { titulo: 'Novedades', cambios: ['Nuevo módulo para asistencia.'] },
          { titulo: 'Correcciones', cambios: ['Se corrigió el foco.'] }
        ]
      },
      {
        version: '1.0.0',
        fecha: '2026-06-23',
        grupos: [{ titulo: 'Seguridad', cambios: ['Se validó la sesión.'] }]
      }
    ]);
  });

  it('formatea fechas ISO sin cambiar texto no fechado', () => {
    expect(formatearFechaChangelog('2026-06-23')).toBe('23 de junio de 2026');
    expect(formatearFechaChangelog('Próximo lanzamiento')).toBe('Próximo lanzamiento');
  });
});
