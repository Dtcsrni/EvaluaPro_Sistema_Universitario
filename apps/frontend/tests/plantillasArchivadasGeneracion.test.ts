import { describe, expect, it } from 'vitest';
import { filtrarPlantillasArchivadasDePeriodosCerrados } from '../src/apps/app_docente/features/plantillas/hooks/usePlantillasArchivadasGeneracion';
import type { Periodo, Plantilla } from '../src/apps/app_docente/tipos';

describe('filtrar plantillas archivadas para extraordinarios', () => {
  const ahora = Date.UTC(2026, 9, 5);
  const plantillas: Plantilla[] = [
    { _id: 'archivada', titulo: 'Global archivado', tipo: 'global', numeroPaginas: 2, periodoId: 'cerrado', archivadoEn: '2026-10-01' },
    { _id: 'activa', titulo: 'Global activo', tipo: 'global', numeroPaginas: 2, periodoId: 'cerrado' },
    { _id: 'periodo-abierto', titulo: 'Global futuro', tipo: 'global', numeroPaginas: 2, periodoId: 'abierto', archivadoEn: '2026-10-01' }
  ];
  const periodos: Periodo[] = [
    { _id: 'cerrado', nombre: 'Concluido', fechaFin: '2026-09-30' },
    { _id: 'abierto', nombre: 'En curso', fechaFin: '2026-10-06' }
  ];

  it('conserva únicamente plantillas archivadas de periodos ya concluidos', () => {
    expect(filtrarPlantillasArchivadasDePeriodosCerrados(plantillas, periodos, ahora).map(({ _id }) => _id))
      .toEqual(['archivada']);
  });

  it('excluye periodos sin fecha de fin válida', () => {
    expect(filtrarPlantillasArchivadasDePeriodosCerrados(plantillas, [
      { _id: 'cerrado', nombre: 'Sin fecha' }
    ], ahora)).toEqual([]);
  });
});
