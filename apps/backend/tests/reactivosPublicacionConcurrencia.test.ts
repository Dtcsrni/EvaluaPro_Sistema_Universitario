import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/infraestructura/baseDatos/sqlite.js';
import { publicarReactivo } from '../src/modulos/modulo_banco_preguntas/servicioReactivos.js';

describe('publicarReactivo', () => {
  it('recupera el resultado si otra solicitud publicó el reactivo primero', async () => {
    const reactivoEnRevision = {
      id: 'reactivo-1', docenteId: 'docente-1', estado: 'review', versionActual: 2, legacyPreguntaId: 'legacy-1'
    };
    const reactivoPublicado = { ...reactivoEnRevision, estado: 'published' };

    vi.spyOn(prisma.reactivo, 'findFirst').mockResolvedValueOnce(reactivoEnRevision as never);
    vi.spyOn(prisma.reactivoVersion, 'findFirst').mockResolvedValueOnce({
      enunciado: 'Reactivo de prueba', metadataJson: '{}', opciones: []
    } as never);
    vi.spyOn(prisma.reactivoAsignacion, 'findFirst').mockResolvedValueOnce({
      periodoId: 'periodo-1', temaId: 'tema-1'
    } as never);
    vi.spyOn(prisma.temaBanco, 'findFirst').mockResolvedValueOnce({ nombre: 'Tema de prueba' } as never);
    vi.spyOn(prisma, '$transaction').mockImplementation((async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        reactivo: {
          updateMany: async () => ({ count: 0 }),
          findFirst: async () => reactivoPublicado
        },
        bancoPregunta: {
          findFirst: async () => ({ id: 'legacy-1' })
        }
      })
    ) as never);

    await expect(publicarReactivo('docente-1', 'reactivo-1')).resolves.toEqual({
      reactivo: reactivoPublicado,
      legacyPreguntaId: 'legacy-1'
    });
  });
});
