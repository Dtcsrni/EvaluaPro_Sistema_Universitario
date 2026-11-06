/**
 * banco.refactor.test
 *
 * Responsabilidad: Pruebas de integración y comportamiento para el módulo de Banco de Preguntas.
 * Limites: Mantener contrato y comportamiento observable del módulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeccionBanco } from '../src/apps/app_docente/SeccionBanco';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';
import type { PermisosUI, Pregunta } from '../src/apps/app_docente/tipos';

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

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
    const { container } = render(
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

    const heading = screen.getByRole('heading', { name: 'Banco de preguntas' });
    expect(heading.querySelector('svg')).toBeNull();
    expect(container.querySelector('.banco-panel__icon-orb svg')).toBeInTheDocument();
    const avisoPermisos = screen.getByText(/Tu perfil no tiene permiso de gestión para crear o editar preguntas o temas/i);
    expect(avisoPermisos.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /^Validar y guardar borrador$/i })).toBeDisabled();
  });

  it('ofrece saltos de teclado a las tareas disponibles y conserva los paneles montados', () => {
    render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1' }]}
        permisos={permisosCompletos}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    const navegacion = screen.getByRole('navigation', { name: 'Tareas del banco de reactivos' });
    const destinos = [
      ['Capturar', 'banco-captura'],
      ['Importar', 'banco-importacion'],
      ['Gestionar temas', 'banco-temas'],
      ['Consultar reactivos', 'banco-listado']
    ] as const;

    for (const [nombre, id] of destinos) {
      const enlace = screen.getByRole('link', { name: nombre });
      expect(navegacion).toContainElement(enlace);
      expect(enlace).toHaveAttribute('href', `#${id}`);
      expect(enlace).toHaveClass('boton', 'secundario');
      expect(document.getElementById(id)).toHaveAttribute('tabindex', '-1');
    }
    expect(document.getElementById('banco-captura')).toBeInTheDocument();
    expect(document.getElementById('banco-importacion')).toBeInTheDocument();
    expect(document.getElementById('banco-temas')).toBeInTheDocument();
    expect(document.getElementById('banco-listado')).toBeInTheDocument();
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

    const opcionInputs = screen.getAllByPlaceholderText(/Texto de la opción/i);
    expect(opcionInputs.length).toBe(5);

    fireEvent.change(opcionInputs[0]!, { target: { value: '3.1416' } });
    fireEvent.change(opcionInputs[1]!, { target: { value: '2.7182' } });
    fireEvent.change(opcionInputs[2]!, { target: { value: '1.4142' } });
    fireEvent.change(opcionInputs[3]!, { target: { value: '1.6180' } });
    fireEvent.change(opcionInputs[4]!, { target: { value: '0.5772' } });

    expect(opcionInputs[0]).toHaveValue('3.1416');
  });

  it('anuncia como alerta un error de guardado del reactivo', async () => {
    vi.mocked(emitToast).mockClear();
    vi.spyOn(clienteApi, 'obtener').mockResolvedValue({ temas: [{ _id: 'tema-1', nombre: 'Álgebra', periodoId: 'per-1' }] });
    const enviarConPermiso = vi.fn().mockRejectedValue(new Error('Conflicto al guardar el reactivo.'));

    render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Matemáticas I' }]}
        permisos={permisosCompletos}
        enviarConPermiso={enviarConPermiso}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Materia$/i), { target: { value: 'per-1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Álgebra' })).toBeInTheDocument());
    fireEvent.change(document.querySelector('#banco-select-tema') as HTMLSelectElement, { target: { value: 'tema-1' } });
    fireEvent.change(screen.getByPlaceholderText(/Redacta una pregunta clara y directa/i), { target: { value: 'Pregunta de prueba' } });
    screen.getAllByPlaceholderText(/Texto de la opción/i).forEach((input, index) => {
      fireEvent.change(input, { target: { value: `Respuesta ${index + 1}` } });
    });
    fireEvent.click(screen.getByRole('button', { name: /Validar y guardar borrador/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Conflicto al guardar el reactivo.');
    expect(screen.getByPlaceholderText(/Redacta una pregunta clara y directa/i)).toHaveValue('Pregunta de prueba');
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('distingue el fallo al cargar temas del estado sin temas en la captura', async () => {
    const obtener = vi.spyOn(clienteApi, 'obtener').mockImplementation(async (ruta) => {
      if (ruta.includes('/banco-preguntas/temas')) throw new Error('Servidor local no disponible.');
      return {};
    });

    const enviarConPermiso = vi.fn().mockResolvedValue({});
    render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Matemáticas I' }]}
        permisos={permisosCompletos}
        enviarConPermiso={enviarConPermiso}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Materia$/i), { target: { value: 'per-1' } });

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los temas');
    expect(screen.getByText('No se pudo comprobar la lista de temas.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Temas para reintentar' })).toHaveAttribute('href', '#banco-temas');
    expect(screen.queryByText(/Primero crea un tema/)).not.toBeInTheDocument();
    obtener.mockRestore();
  });

  it('conserva los temas cargados si falla la actualización de la misma materia', async () => {
    let consultasTemas = 0;
    const obtener = vi.spyOn(clienteApi, 'obtener').mockImplementation(async (ruta) => {
      if (ruta.includes('/banco-preguntas/temas')) {
        consultasTemas += 1;
        if (consultasTemas === 1) {
          return { temas: [{ _id: 'tema-1', nombre: 'Álgebra', periodoId: 'per-1' }] };
        }
        throw new Error('Servidor local no disponible.');
      }
      return {};
    });

    render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Matemáticas I' }]}
        permisos={permisosCompletos}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    expect(await screen.findByRole('option', { name: 'Álgebra' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre del tema nuevo'), { target: { value: 'Geometría' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar tema' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los temas');
    expect(screen.getAllByText('Álgebra')).toHaveLength(2);
    expect(screen.getByText('Se conservan los temas de la última consulta de esta materia; no fue posible comprobar si siguen actualizados.')).toHaveAttribute('role', 'note');
    expect(screen.queryByText('No hay temas. Crea el primero arriba.')).not.toBeInTheDocument();
    obtener.mockRestore();
  });

  it('identifica la respuesta correcta y la imagen adjunta, y permite filtrar el listado', () => {
    const preguntasMock: Pregunta[] = [
      {
        _id: 'preg-1',
        reactivoId: 'reactivo-1',
        periodoId: 'per-1',
        tema: 'Álgebra',
        versionActual: 1,
        versiones: [
          {
            numeroVersion: 1,
            enunciado: '¿Qué es una función cuadrática?',
            opciones: [
              { texto: 'Una función polinómica de grado 2', esCorrecta: true },
              { texto: 'Una recta en el plano', esCorrecta: false },
              { texto: 'Una constante', esCorrecta: false },
              { texto: 'Una función exponencial', esCorrecta: false },
              { texto: 'Una función logarítmica', esCorrecta: false }
            ],
            imagenUrl: 'data:image/png;base64,AA==',
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

    expect(screen.getAllByText('¿Qué es una función cuadrática?').length).toBeGreaterThan(0);
    expect(screen.getByText('¿Cuál es la primera ley de Newton?')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Respuesta correcta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Todos los temas' })).toBeInTheDocument();
    const metadatosPreguntas = document.querySelectorAll('.banco-listado__sub');
    expect([...metadatosPreguntas].some((element) => element.textContent?.includes('5 opciones cargadas · Con imagen de apoyo'))).toBe(true);
    expect([...metadatosPreguntas].some((element) => element.textContent?.includes('2 opciones cargadas · Sin imagen de apoyo'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /^Editar pregunta:/i }));
    expect(screen.getByText('Imagen adjunta')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('✓');

    const inputBuscar = screen.getByLabelText(/Buscar en enunciado/i);
    fireEvent.change(inputBuscar, { target: { value: 'cuadrática' } });

    expect(screen.getAllByText('¿Qué es una función cuadrática?').length).toBeGreaterThan(0);
    expect(screen.queryByText('¿Cuál es la primera ley de Newton?')).not.toBeInTheDocument();
  });

  it('mantiene el error del historial visible y permite reintentar sin exponer datos de conexión', async () => {
    vi.mocked(emitToast).mockClear();
    const obtener = vi.spyOn(clienteApi, 'obtener').mockImplementation(async (ruta) => {
      if (ruta.includes('/versiones')) throw new Error('ECONNREFUSED 127.0.0.1:3000');
      return { temas: [] };
    });
    const preguntas: Pregunta[] = [{
      _id: 'preg-historial',
      reactivoId: 'reactivo-historial',
      periodoId: 'per-1',
      tema: 'Álgebra',
      versionActual: 1,
      versiones: [{ numeroVersion: 1, enunciado: 'Pregunta de historial', opciones: [{ texto: 'Respuesta A', esCorrecta: true }] }]
    }];

    render(
      <SeccionBanco
        preguntas={preguntas}
        periodos={[{ _id: 'per-1', nombre: 'Matemáticas I' }]}
        permisos={permisosCompletos}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Materia$/i), { target: { value: 'per-1' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Versiones del reactivo:/i }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Servidor local no disponible.');
    expect(error).not.toHaveTextContent('127.0.0.1:3000');
    expect(screen.getByRole('button', { name: 'Reintentar carga del historial' })).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga del historial' }));
    await waitFor(() => {
      expect(obtener.mock.calls.filter(([ruta]) => ruta.includes('/versiones'))).toHaveLength(2);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Servidor local no disponible.');
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('conserva el tema seleccionado al guardar una pregunta para facilitar la captura consecutiva', async () => {
    const mockEnviar = vi.fn()
      .mockResolvedValueOnce({
        importId: 'imp-manual',
        planHash: 'plan-manual',
        summary: { create: 1, noOp: 0, newVersion: 0, conflict: 0, error: 0 }
      })
      .mockResolvedValueOnce({
        draftReactivoIds: ['reactivo-manual'],
        reactivoIds: ['reactivo-manual']
      })
      .mockResolvedValueOnce({ reactivo: { id: 'reactivo-manual', estado: 'review' } })
      .mockResolvedValueOnce({ reactivo: { id: 'reactivo-manual', estado: 'published' } });
    vi.spyOn(clienteApi, 'obtener').mockResolvedValue({
      temas: [{ _id: 't-1', nombre: 'Cookies y sesiones', materiaId: 'per-1' }]
    });

    const { container } = render(
      <SeccionBanco
        preguntas={[] as Pregunta[]}
        periodos={[{ _id: 'per-1', nombre: 'Desarrollo Web' }]}
        permisos={permisosCompletos}
        enviarConPermiso={mockEnviar}
        avisarSinPermiso={() => {}}
        onRefrescar={() => {}}
        onRefrescarPlantillas={() => {}}
        paginasEstimadasBackendPorTema={new Map()}
      />
    );

    const selectMateria = screen.getByLabelText(/^Materia$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Cookies y sesiones' })).toBeInTheDocument();
    });

    const selectTema = container.querySelector('#banco-select-tema') as HTMLSelectElement;
    expect(selectTema).toBeInTheDocument();
    fireEvent.change(selectTema, { target: { value: 't-1' } });
    expect(selectTema).toHaveValue('t-1');

    const inputEnunciado = screen.getByPlaceholderText(/Redacta una pregunta clara y directa/i);
    fireEvent.change(inputEnunciado, { target: { value: '¿Qué cabecera HTTP envía una cookie?' } });

    const opcionInputs = screen.getAllByPlaceholderText(/Texto de la opción/i);
    fireEvent.change(opcionInputs[0]!, { target: { value: 'Set-Cookie' } });
    fireEvent.change(opcionInputs[1]!, { target: { value: 'Cookie-Header' } });
    fireEvent.change(opcionInputs[2]!, { target: { value: 'Authorization' } });
    fireEvent.change(opcionInputs[3]!, { target: { value: 'Accept' } });
    fireEvent.change(opcionInputs[4]!, { target: { value: 'Host' } });

    const btnGuardar = screen.getByRole('button', { name: /^Validar y guardar borrador$/i });
    fireEvent.click(btnGuardar);

    expect(mockEnviar).toHaveBeenNthCalledWith(
      1,
      'banco:ingestar',
      '/banco-preguntas/importaciones/preview',
      expect.objectContaining({
        target: { periodoId: 'per-1', temaIds: ['t-1'] },
        items: [
          expect.objectContaining({
            externalKey: expect.stringMatching(/^manual-/),
            stem: {
              format: 'richtext',
              value: '¿Qué cabecera HTTP envía una cookie?'
            },
            options: expect.arrayContaining([
              { key: 'A', value: 'Set-Cookie', isCorrect: true },
              { key: 'B', value: 'Cookie-Header', isCorrect: false },
              { key: 'C', value: 'Authorization', isCorrect: false },
              { key: 'D', value: 'Accept', isCorrect: false },
              { key: 'E', value: 'Host', isCorrect: false }
            ])
          })
        ]
      }),
      expect.any(String)
    );
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(2));
    expect(mockEnviar).toHaveBeenNthCalledWith(
      2,
      'banco:ingestar',
      '/banco-preguntas/importaciones/imp-manual/confirmar',
      expect.objectContaining({ planHash: 'plan-manual', payload: expect.objectContaining({ batchId: expect.stringContaining('manual-') }) }),
      expect.any(String)
    );
    expect(await screen.findByRole('button', { name: 'Enviar a revisión (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a revisión (1)' }));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar revisados (1)' }));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(4));
    expect(mockEnviar).toHaveBeenNthCalledWith(3, 'banco:revisar', '/banco-preguntas/reactivos/reactivo-manual/revisar', {}, expect.any(String));
    expect(mockEnviar).toHaveBeenNthCalledWith(4, 'banco:publicar', '/banco-preguntas/reactivos/reactivo-manual/publicar', {}, expect.any(String));

    // El enunciado se limpia tras guardar para la siguiente pregunta pero el tema permanece seleccionado
    await waitFor(() => {
      expect(inputEnunciado).toHaveValue('');
    });
    expect(selectTema).toHaveValue('t-1');
  });
});
