/**
 * banco.refactor.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeccionBanco } from '../src/apps/app_docente/SeccionBanco';
import type { PermisosUI, Pregunta } from '../src/apps/app_docente/tipos';

const permisos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: false, archivar: false },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true },
  omr: { analizar: true },
  calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

describe('banco refactor comportamiento', () => {
  it('renderiza banco y bloquea edición sin permiso de gestión', () => {
    render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1' }]}
        permisos={permisos}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    expect(screen.getByRole('heading', { name: /Banco de preguntas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Guardar$/i })).toBeDisabled();
  });
});
