import { describe, expect, it } from 'vitest';
import { guardarLotePendiente, leerLotePendiente, validarResumenLoteGenerado } from '../src/apps/app_docente/features/plantillas/loteGeneracionSesion';

describe('persistencia de lote reanudable por plantilla', () => {
  it('conserva el identificador al cambiar de plantilla y lo borra al completar', () => {
    const almacenamiento = new Map<string, string>();
    const storage = {
      getItem: (key: string) => almacenamiento.get(key) ?? null,
      setItem: (key: string, value: string) => almacenamiento.set(key, value),
      removeItem: (key: string) => almacenamiento.delete(key)
    } as unknown as Storage;

    guardarLotePendiente('plantilla-a', 'LOTE-123', storage);
    expect(leerLotePendiente('plantilla-a', storage)).toBe('LOTE-123');
    expect(leerLotePendiente('plantilla-b', storage)).toBeNull();

    guardarLotePendiente('plantilla-a', null, storage);
    expect(leerLotePendiente('plantilla-a', storage)).toBeNull();
  });

  it('tolera que localStorage esté bloqueado', () => {
    const almacenamientoBloqueado = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
      removeItem: () => { throw new Error('SecurityError'); }
    } as unknown as Storage;

    expect(leerLotePendiente('plantilla-a', almacenamientoBloqueado)).toBeNull();
    expect(() => guardarLotePendiente('plantilla-a', 'LOTE-123', almacenamientoBloqueado)).not.toThrow();
  });

  it('sólo acepta el conteo de páginas exacto y una huella SHA-256 válida', () => {
    const resumen = {
      totalPaginas: 8,
      paginasPorExamen: 4,
      pdfSha256: 'a'.repeat(64),
      examenesGenerados: [{}, {}],
      lotePdfUrl: '/examenes/generados/lote/LOT-123/pdf'
    };
    expect(() => validarResumenLoteGenerado(resumen, 2, 4)).not.toThrow();
    expect(() => validarResumenLoteGenerado({ ...resumen, totalPaginas: 7 }, 2, 4)).toThrow(/se esperaban 8\./);
    expect(() => validarResumenLoteGenerado({ ...resumen, paginasPorExamen: 5, totalPaginas: 10 }, 2, 4)).toThrow(/máximo es 4/);
    expect(() => validarResumenLoteGenerado({ ...resumen, pdfSha256: 'no-hash' }, 2, 4)).toThrow(/SHA-256/);
    expect(() => validarResumenLoteGenerado({ ...resumen, examenesGenerados: [{}] }, 2, 4)).toThrow(/grupo/);
    expect(() => validarResumenLoteGenerado({ ...resumen, lotePdfUrl: 'https://example.test/falso.pdf' }, 2, 4)).toThrow(/ruta válida/);
  });
});
