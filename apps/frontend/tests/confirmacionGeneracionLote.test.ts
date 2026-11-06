import { describe, expect, it } from 'vitest';
import { crearContenidoConfirmacionGeneracionLote } from '../src/apps/app_docente/features/plantillas/confirmacionGeneracionLote';

describe('confirmación de generación con formulario compartido', () => {
  it('advierte explícitamente que todo el grupo comparte variante y clave', () => {
    const confirmacion = crearContenidoConfirmacionGeneracionLote({
      variantPolicy: 'shared',
      lotePendiente: false,
      cantidadAlumnos: 12,
      grupo: '23A'
    });

    expect(confirmacion.tone).toBe('warning');
    expect(confirmacion.title).toContain('formulario compartido');
    expect(confirmacion.message).toContain('misma clave de respuestas');
    expect(confirmacion.details.join(' ')).toMatch(/riesgo de copiar respuestas/i);
    expect(confirmacion.details.join(' ')).toMatch(/QR firmado y folio propios/i);
    expect(confirmacion.confirmLabel).toContain('formulario compartido');
  });

  it('conserva confirmación neutral para el modo aleatorio predeterminado', () => {
    const confirmacion = crearContenidoConfirmacionGeneracionLote({
      variantPolicy: 'unique',
      lotePendiente: false,
      cantidadAlumnos: 12,
      grupo: '23A'
    });

    expect(confirmacion.tone).toBe('default');
    expect(confirmacion.details.join(' ')).not.toMatch(/misma clave|copiar respuestas/i);
  });
});
