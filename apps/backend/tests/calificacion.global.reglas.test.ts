/**
 * calificacion.global.reglas.test
 *
 * Reglas bloqueantes para calificacion global.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calcularCalificacion } from '../src/modulos/modulo_calificacion/servicioCalificacion';

function numeroSeguro(texto: unknown) {
  const n = Number(String(texto ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

async function escribirReporteQa(ruta: string, contenido: string) {
  const directorio = path.dirname(ruta);
  const temporal = path.join(directorio, `.${path.basename(ruta)}.${process.pid}.${Date.now()}.tmp`);
  const alterno = path.join(os.tmpdir(), 'evaluapro-qa-reports', `${path.basename(ruta, path.extname(ruta))}-${process.pid}-${Date.now()}.json`);
  const esErrorPermiso = (error: unknown) => {
    const codigo = (error as NodeJS.ErrnoException)?.code;
    return codigo === 'EPERM' || codigo === 'EACCES';
  };
  const escribirAlterno = async () => {
    await fs.mkdir(path.dirname(alterno), { recursive: true });
    await fs.writeFile(alterno, contenido, 'utf8');
  };
  try {
    try {
      await fs.writeFile(temporal, contenido, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (!esErrorPermiso(error)) throw error;
      await escribirAlterno();
      return;
    }
    try {
      await fs.rename(temporal, ruta);
    } catch (error) {
      if (!esErrorPermiso(error)) throw error;
      await escribirAlterno();
    }
  } finally {
    await fs.rm(temporal, { force: true }).catch(() => undefined);
  }
}

describe('calificacion global (reglas)', () => {
  it('respeta topes y consistencia para valores tipicos', () => {
    const resultado = calcularCalificacion(20, 20, 0.5, 5, 5, 'global');
    expect(resultado.calificacionFinalTexto).toBe('5');
    expect(resultado.proyectoTexto).toBe('5');
    expect(resultado.calificacionGlobalTexto).toBe('10');
    expect(resultado.calificacionParcialTexto).toBeUndefined();
  });

  it('mantiene invariantes en combinaciones validas', async () => {
    const muestras = [];
    for (let total = 1; total <= 40; total += 1) {
      for (let aciertos = 0; aciertos <= total; aciertos += 1) {
        for (const proyecto of [0, 1, 2.5, 5]) {
          const r = calcularCalificacion(aciertos, total, 0.5, 0, proyecto, 'global');
          const examen = numeroSeguro(r.calificacionFinalTexto);
          const global = numeroSeguro(r.calificacionGlobalTexto);
          expect(examen).toBeGreaterThanOrEqual(0);
          expect(examen).toBeLessThanOrEqual(5);
          expect(global).toBeGreaterThanOrEqual(0);
          expect(global).toBeLessThanOrEqual(10);
          expect(global).toBeGreaterThanOrEqual(examen);
          muestras.push({ aciertos, total, proyecto, examen, global });
        }
      }
    }

    const reporte = {
      version: '1',
      ejecutadoEn: new Date().toISOString(),
      estado: 'ok',
      totalMuestras: muestras.length
    };
    const out = path.resolve(process.cwd(), 'reports/qa/latest/global-grade.json');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await escribirReporteQa(out, `${JSON.stringify(reporte, null, 2)}\n`);
  });
});

