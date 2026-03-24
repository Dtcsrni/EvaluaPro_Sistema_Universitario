/**
 * papelera.servicio.test
 *
 * Responsabilidad: Verificar el contrato de retencion y persistencia del servicio
 * de papelera sin depender de una base de datos real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPapeleraCreate } = vi.hoisted(() => ({
  mockPapeleraCreate: vi.fn()
}));

vi.mock('../src/modulos/modulo_papelera/modeloPapelera', () => ({
  Papelera: {
    create: mockPapeleraCreate
  }
}));

import { guardarEnPapelera } from '../src/modulos/modulo_papelera/servicioPapelera';

describe('servicioPapelera.guardarEnPapelera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T12:00:00.000Z'));
  });

  it('persiste eliminadoEn y expiraEn con retencion operativa de 45 dias', async () => {
    mockPapeleraCreate.mockResolvedValue({ _id: 'papelera-1' });

    await guardarEnPapelera({
      docenteId: 'docente-1',
      tipo: 'alumno',
      entidadId: 'alumno-1',
      payload: { alumno: { _id: 'alumno-1' } }
    });

    expect(mockPapeleraCreate).toHaveBeenCalledTimes(1);
    const payload = mockPapeleraCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.docenteId).toBe('docente-1');
    expect(payload.tipo).toBe('alumno');
    expect(payload.entidadId).toBe('alumno-1');
    expect(payload.payload).toEqual({ alumno: { _id: 'alumno-1' } });
    expect(payload.eliminadoEn).toBeInstanceOf(Date);
    expect(payload.expiraEn).toBeInstanceOf(Date);
    expect((payload.eliminadoEn as Date).toISOString()).toBe('2026-03-24T12:00:00.000Z');
    expect((payload.expiraEn as Date).toISOString()).toBe('2026-05-08T12:00:00.000Z');
  });
});
