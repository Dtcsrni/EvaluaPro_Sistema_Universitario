import { describe, expect, it, vi } from 'vitest';
import { confirmarLoteEnHistorial, guardarLotePendiente, leerLotePendiente, validarLoteListoParaDescarga, validarRegistroLoteEnHistorial, validarResumenLoteGenerado } from '../src/apps/app_docente/features/plantillas/loteGeneracionSesion';

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

  it('solo confirma el lote cuando el registro canónico del historial coincide en identidad y huella', () => {
    const esperado = {
      loteId: 'LOT-123',
      plantillaId: 'plantilla-1',
      totalExamenes: 2,
      totalPaginas: 8,
      sha256: 'a'.repeat(64)
    };
    const lote = {
      ...esperado,
      sha256: esperado.sha256.toUpperCase(),
      archivado: false
    };

    expect(() => validarRegistroLoteEnHistorial(lote, esperado)).not.toThrow();
    expect(() => validarRegistroLoteEnHistorial(null, esperado)).toThrow(/no confirmó el lote en el historial/i);
    expect(() => validarRegistroLoteEnHistorial({ ...lote, totalExamenes: 1 }, esperado)).toThrow(/exámenes/);
    expect(() => validarRegistroLoteEnHistorial({ ...lote, sha256: 'b'.repeat(64) }, esperado)).toThrow(/huella/);
    expect(() => validarRegistroLoteEnHistorial({ ...lote, loteId: 'LOT-OTRO' }, esperado)).toThrow(/identificador/);
    expect(() => validarRegistroLoteEnHistorial({ ...lote, archivado: true }, esperado)).toThrow(/archivado/);
  });

  it('busca el lote a través de todas las páginas del historial y rechaza cursores repetidos', async () => {
    const esperado = {
      loteId: 'LOT-123',
      plantillaId: 'plantilla-1',
      totalExamenes: 2,
      totalPaginas: 8,
      sha256: 'a'.repeat(64)
    };
    const consultarPagina = vi.fn()
      .mockResolvedValueOnce({ lotes: [], nextCursor: 'siguiente' })
      .mockResolvedValueOnce({ lotes: [{ ...esperado, archivado: false }], nextCursor: null });

    await expect(confirmarLoteEnHistorial(esperado, consultarPagina)).resolves.toMatchObject({ loteId: 'LOT-123' });
    expect(consultarPagina).toHaveBeenCalledTimes(2);
    expect(consultarPagina.mock.calls[1]?.[0]).toContain('cursor=siguiente');

    const cursorRepetido = vi.fn()
      .mockResolvedValue({ lotes: [], nextCursor: 'mismo-cursor' });
    await expect(confirmarLoteEnHistorial(esperado, cursorRepetido)).rejects.toThrow(/repitió un cursor/);
  });

  it('requiere respuesta y progreso persistido congruentes antes de habilitar descarga', () => {
    const respuesta = {
      loteId: 'LOT-123',
      totalAlumnos: 2,
      totalPaginas: 8,
      paginasPorExamen: 4,
      pdfSha256: 'a'.repeat(64),
      lotePdfUrl: '/examenes/generados/lote/LOT-123/pdf',
      examenesGenerados: [{}, {}]
    };
    const progreso = {
      loteId: 'LOT-123',
      estado: 'completado',
      completado: true,
      loteRegistrado: true,
      artefactoVerificado: true,
      totalEsperado: 2,
      generados: 2,
      totalPaginas: 8,
      pdfSha256: 'a'.repeat(64)
    };
    const esperado = { loteId: 'LOT-123', totalAlumnos: 2, paginasMaximasPorExamen: 4 };

    expect(() => validarLoteListoParaDescarga(respuesta, progreso, esperado)).not.toThrow();
    expect(() => validarLoteListoParaDescarga(respuesta, { ...progreso, completado: false }, esperado)).toThrow(/no confirmó/);
    expect(() => validarLoteListoParaDescarga({ ...respuesta, totalPaginas: 7 }, progreso, esperado)).toThrow(/páginas/);
    expect(() => validarLoteListoParaDescarga({ ...respuesta, loteId: 'otro' }, progreso, esperado)).toThrow(/identificador/);
  });
});
