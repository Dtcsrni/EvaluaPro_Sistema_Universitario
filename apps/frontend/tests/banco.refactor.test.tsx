/**
 * banco.refactor.test
 *
 * Responsabilidad: Pruebas de integración y comportamiento para el módulo de Banco de Preguntas.
 * Limites: Mantener contrato y comportamiento observable del módulo.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeccionBanco } from '../src/apps/app_docente/SeccionBanco';
import type { PermisosUI, Pregunta } from '../src/apps/app_docente/tipos';

const permisosLectura: PermisosUI = {
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

const permisosCompletos: PermisosUI = {
  ...permisosLectura,
  banco: { leer: true, gestionar: true, archivar: true }
};

describe('banco refactor comportamiento', () => {
  it('renderiza banco y bloquea edición sin permiso de gestión', () => {
    render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1' }]}
        permisos={permisosLectura}
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

  it('permite interactuar con el formulario y escribir opciones cuando tiene permisos completos', () => {
    const mockEnviar = vi.fn().mockResolvedValue({});

    render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Matemáticas I' }]}
        permisos={permisosCompletos}
        enviarConPermiso={mockEnviar}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    expect(screen.getByRole('heading', { name: /Banco de preguntas/i })).toBeInTheDocument();

    const selectMateria = screen.getByLabelText(/^Materia$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    const inputEnunciado = screen.getByPlaceholderText(/Redacta una pregunta clara y directa/i);
    fireEvent.change(inputEnunciado, { target: { value: '¿Cuál es el valor de Pi aproximado?' } });

    const opcionInputs = screen.getAllByPlaceholderText(/Texto opcion/i);
    expect(opcionInputs.length).toBe(5);

    fireEvent.change(opcionInputs[0]!, { target: { value: '3.1416' } });
    fireEvent.change(opcionInputs[1]!, { target: { value: '2.7182' } });
    fireEvent.change(opcionInputs[2]!, { target: { value: '1.4142' } });
    fireEvent.change(opcionInputs[3]!, { target: { value: '1.6180' } });
    fireEvent.change(opcionInputs[4]!, { target: { value: '0.5772' } });

    expect(opcionInputs[0]).toHaveValue('3.1416');
  });

  it('renderiza preguntas existentes y permite filtrar por texto en el listado', () => {
    const preguntasMock: Pregunta[] = [
      {
        _id: 'preg-1',
        periodoId: 'per-1',
        tema: 'Álgebra',
        versionActual: 1,
        versiones: [
          {
            numeroVersion: 1,
            enunciado: '¿Qué es una función cuadrática?',
            opciones: [
              { texto: 'Una función polinómica de grado 2', esCorrecta: true },
              { texto: 'Una recta en el plano', esCorrecta: false }
            ],
            creadoEn: '2026-01-01T00:00:00.000Z'
          }
        ]
      },
      {
        _id: 'preg-2',
        periodoId: 'per-1',
        tema: 'Física',
        versionActual: 1,
        versiones: [
          {
            numeroVersion: 1,
            enunciado: '¿Cuál es la primera ley de Newton?',
            opciones: [
              { texto: 'Ley de la inercia', esCorrecta: true },
              { texto: 'Fuerza es masa por aceleración', esCorrecta: false }
            ],
            creadoEn: '2026-01-01T00:00:00.000Z'
          }
        ]
      }
    ];

    render(
      <SeccionBanco
        preguntas={preguntasMock}
        periodos={[{ _id: 'per-1', nombre: 'Ciencias Básicas' }]}
        permisos={permisosCompletos}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    // Seleccionar materia para activar listado
    const selectMateria = screen.getByLabelText(/^Materia$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    expect(screen.getByText('¿Qué es una función cuadrática?')).toBeInTheDocument();
    expect(screen.getByText('¿Cuál es la primera ley de Newton?')).toBeInTheDocument();

    const inputBuscar = screen.getByLabelText(/Buscar en enunciado/i);
    fireEvent.change(inputBuscar, { target: { value: 'cuadrática' } });

    expect(screen.getByText('¿Qué es una función cuadrática?')).toBeInTheDocument();
    expect(screen.queryByText('¿Cuál es la primera ley de Newton?')).not.toBeInTheDocument();
  });
});
