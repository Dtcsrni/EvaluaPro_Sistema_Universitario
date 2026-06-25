/**
 * papelera.servicio.test
 *
 * Responsabilidad: Verificar el contrato del servicio de papelera usando SQLite.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { prisma } from '../src/infraestructura/baseDatos/sqlite';
import { guardarEnPapelera } from '../src/modulos/modulo_papelera/servicioPapelera';

describe('servicioPapelera.guardarEnPapelera (integracion)', () => {
  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('persiste el item de papelera correctamente en SQLite', async () => {
    await prisma.docente.create({
      data: {
        id: 'docente-1',
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@evaluapro.local'
      }
    });

    const payloadObj = { alumno: { id: 'alumno-1', nombre: 'Ana' } };

    const created = await guardarEnPapelera({
      docenteId: 'docente-1',
      tipo: 'alumno',
      entidadId: 'alumno-1',
      payload: payloadObj
    });

    expect(created.id).toBeDefined();
    expect(created.docenteId).toBe('docente-1');
    expect(created.tipo).toBe('alumno');
    expect(created.itemId).toBe('alumno-1');
    expect(JSON.parse(created.datosJson)).toEqual(payloadObj);

    const persisted = await prisma.papeleraItem.findUnique({
      where: { id: created.id }
    });
    expect(persisted).toBeDefined();
    expect(persisted?.itemId).toBe('alumno-1');
  });
});
