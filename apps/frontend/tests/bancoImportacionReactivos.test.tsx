import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BancoImportacionReactivos } from '../src/apps/app_docente/features/banco/components/BancoImportacionReactivos';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

const temas = [{ _id: 'tema-bi-sp', nombre: 'Segundo Parcial', periodoId: 'bi-1' }];

function renderImportacion() {
  return render(
    <BancoImportacionReactivos
      periodoId="bi-1"
      temas={temas}
      puedeGestionar
      onRefrescar={vi.fn()}
    />
  );
}

function subirArchivo(archivo = new File(['{}'], 'reactivos.json', { type: 'application/json' })) {
  const input = document.getElementById('reactivos-json-file');
  if (!(input instanceof HTMLInputElement)) throw new Error('No se encontró el selector nativo de archivos.');
  fireEvent.change(input, { target: { files: [archivo] } });
}

describe('BancoImportacionReactivos', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mantiene el flujo inicial simple y exige archivo antes de validar', () => {
    renderImportacion();

    expect(screen.getByRole('heading', { name: 'Importar reactivos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validar archivo' })).toBeDisabled();
    expect(screen.getByText(/Formatos JSON, JSONL o XLSX · contrato v1/i)).toBeInTheDocument();
    expect(screen.getByText('Sin archivo seleccionado.').closest('[role="status"]')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByRole('list', { name: 'Pasos de importación' }).querySelector('[aria-current="step"]'))
      .toHaveTextContent('Selecciona archivo');
  });

  it('conserva un selector de archivo accesible con un disparador legible', () => {
    renderImportacion();

    const input = document.getElementById('reactivos-json-file');
    const disparador = screen.getByRole('button', { name: 'Seleccionar archivo de reactivos' });
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveClass('sr-only');
    expect(input).toHaveAttribute('aria-hidden', 'true');
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(disparador).toHaveAttribute('aria-describedby', 'banco-reactivos-import-hint banco-reactivos-import-file');
    expect(disparador).toHaveTextContent('Elegir archivo');
  });

  it('muestra archivos grandes en MB para evitar cifras extensas en KB', () => {
    renderImportacion();
    const archivo = new File([new Uint8Array(2 * 1024 * 1024)], 'reactivos.json', { type: 'application/json' });
    subirArchivo(archivo);

    const estadoSeleccion = screen.getByText('reactivos.json').closest('[role="status"]');
    expect(estadoSeleccion).toHaveTextContent(/Archivo seleccionado: reactivos\.json/);
    expect(estadoSeleccion).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByText('reactivos.json').closest('p')).toHaveTextContent(/reactivos\.json.*2 MB/);
  });

  it('anuncia errores del preview sin borrar el archivo y mantiene el paso actual accesible', async () => {
    vi.spyOn(clienteApi, 'enviarFormData').mockRejectedValue(new Error('El lote de reactivos no cumple el contrato v1'));
    renderImportacion();
    subirArchivo();
    expect(screen.getByRole('list', { name: 'Pasos de importación' }).querySelector('[aria-current="step"]'))
      .toHaveTextContent('Valida la vista previa');
    fireEvent.click(screen.getByRole('button', { name: 'Validar archivo' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta.querySelector('.mensaje__icono svg')).not.toBeNull();
    expect(alerta).toHaveTextContent('Formato no compatible.');
    expect(alerta).toHaveTextContent('Corrige el archivo con la plantilla o el esquema y valida de nuevo.');
    expect(alerta).not.toHaveTextContent('REACTIVOS_PAYLOAD_INVALIDO');
    expect(screen.getByText('reactivos.json')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Pasos de importación' }).querySelector('[aria-current="step"]'))
      .toHaveTextContent('Valida la vista previa');
  });

  it('traduce el fallo de conectividad a una instrucción útil sin exponer el endpoint local', async () => {
    vi.spyOn(clienteApi, 'enviarFormData').mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5200'));
    renderImportacion();
    subirArchivo();
    fireEvent.click(screen.getByRole('button', { name: 'Validar archivo' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/Servidor local no disponible/i);
    expect(alerta).not.toHaveTextContent(/127\.0\.0\.1:5200/);
    expect(screen.getByText('reactivos.json')).toBeInTheDocument();
  });

  it('distingue un fallo del historial de una materia vacía y permite reintentar', async () => {
    vi.spyOn(clienteApi, 'obtener')
      .mockRejectedValueOnce(new Error('Sin conexión temporal.'))
      .mockResolvedValueOnce({ importaciones: [] });
    renderImportacion();

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión temporal.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga del historial' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('No hay importaciones registradas para esta materia.')).toBeInTheDocument();
    expect(clienteApi.obtener).toHaveBeenCalledTimes(2);
  });

  it('conserva el historial cargado cuando falla un reintento', async () => {
    vi.spyOn(clienteApi, 'obtener')
      .mockResolvedValueOnce({ importaciones: [
        {
          importId: 'imp-bi-previa', batchId: 'lote-previo-bi', periodoId: 'bi-1', estado: 'confirmed',
          inputSha256: 'e'.repeat(64), createdAt: '2026-11-03T10:00:00.000Z',
          summary: { create: 1, noOp: 0, newVersion: 0, conflict: 0, error: 0 }, rows: []
        },
        {
          importId: 'imp-bi2-previa', batchId: 'lote-previo-bi2', periodoId: 'bi-2', estado: 'confirmed',
          inputSha256: 'f'.repeat(64), createdAt: '2026-11-03T11:00:00.000Z',
          summary: { create: 2, noOp: 0, newVersion: 0, conflict: 0, error: 0 }, rows: []
        }
      ] })
      .mockRejectedValue(new Error('Timeout temporal.'));
    const { rerender } = renderImportacion();

    expect(await screen.findByText('lote-previo-bi')).toBeInTheDocument();
    rerender(
      <BancoImportacionReactivos periodoId="bi-2" temas={temas} puedeGestionar onRefrescar={vi.fn()} />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar el historial: Timeout temporal.');
    expect(screen.getByText('lote-previo-bi2')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('se conservan los últimos resultados cargados');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga del historial' }));

    await waitFor(() => expect(clienteApi.obtener).toHaveBeenCalledTimes(3));
    expect(screen.getByText('lote-previo-bi2')).toBeInTheDocument();
    expect(screen.queryByText('No hay importaciones registradas para esta materia.')).not.toBeInTheDocument();
  });

  it('muestra historial durable filtrado por materia y detalle por fila', async () => {
    vi.spyOn(clienteApi, 'obtener').mockResolvedValue({ importaciones: [
      {
        importId: 'imp-bi', batchId: 'ia-bi-segundo-parcial', periodoId: 'bi-1', estado: 'confirmed',
        inputSha256: 'a'.repeat(64), createdAt: '2026-09-23T10:00:00.000Z',
        summary: { create: 2, noOp: 0, newVersion: 1, conflict: 0, error: 0 },
        rows: [{ line: 1, externalKey: 'bi-001', operation: 'create', status: 'applied' }]
      },
      {
        importId: 'imp-otra-materia', batchId: 'ia-otra-materia', periodoId: 'bi-2', estado: 'confirmed',
        inputSha256: 'b'.repeat(64), createdAt: '2026-09-23T10:00:00.000Z',
        summary: { create: 1, noOp: 0, newVersion: 0, conflict: 0, error: 0 }, rows: []
      }
    ] });

    renderImportacion();

    expect(await screen.findByText('ia-bi-segundo-parcial')).toBeInTheDocument();
    expect(screen.getByText('Estado: Importación confirmada')).toBeInTheDocument();
    expect(screen.queryByText('ia-otra-materia')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver filas (1)'));
    expect(await screen.findByText(/bi-001 — Crear reactivo \(Aplicada\)/)).toBeInTheDocument();
  });

  it('tolera entradas de historial sin filas y conserva la pantalla usable', async () => {
    vi.spyOn(clienteApi, 'obtener').mockResolvedValue({ importaciones: [{
      importId: 'imp-sin-filas', batchId: 'ia-sin-filas', periodoId: 'bi-1', estado: 'confirmed',
      inputSha256: 'd'.repeat(64), createdAt: '2026-09-23T10:00:00.000Z',
      summary: { create: 0, noOp: 1, newVersion: 0, conflict: 0, error: 0 }
    }] });

    renderImportacion();

    expect(await screen.findByText('ia-sin-filas')).toBeInTheDocument();
    expect(screen.getByText('Ver filas (0)')).toBeInTheDocument();
  });

  it('expone en el historial las filas DOCX en cuarentena y sus motivos', async () => {
    vi.spyOn(clienteApi, 'obtener').mockResolvedValue({ importaciones: [{
      importId: 'imp-docx', batchId: 'docx-abcdef', periodoId: 'bi-1', estado: 'quarantined',
      inputSha256: 'c'.repeat(64), createdAt: '2026-09-23T10:00:00.000Z',
      summary: { create: 0, noOp: 0, newVersion: 0, conflict: 0, error: 0, quarantined: 1 },
      rows: [{
        line: 1, externalKey: 'docx-abcdef-r1', operation: 'quarantine', status: 'quarantined',
        detail: { reasons: ['TEMA_CANONICO_REQUERIDO', 'OPCIONES_DEBEN_SER_A_E'] }
      }]
    }] });

    renderImportacion();

    expect(await screen.findByText('docx-abcdef')).toBeInTheDocument();
    expect(screen.getByText(/1 reactivo en cuarentena/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver filas (1)'));
    expect(await screen.findByText(/Revisión requerida: TEMA_CANONICO_REQUERIDO, OPCIONES_DEBEN_SER_A_E/)).toBeInTheDocument();
  });

  it('muestra el preview, conserva el detalle bajo demanda y bloquea conflictos', async () => {
    vi.spyOn(clienteApi, 'enviarFormData').mockResolvedValue({
      importId: 'imp-1',
      planHash: 'abcdef1234567890',
      payload: {},
      summary: { create: 1, noOp: 0, newVersion: 0, conflict: 1, error: 0 },
      rows: [{ line: 1, externalKey: 'bi-sp-001', operation: 'conflict', status: 'conflict', detail: { codigo: 'VERSION_CONFLICT', temaId: 'tema-bi-sp' } }]
    });
    const confirmar = vi.spyOn(clienteApi, 'enviar').mockResolvedValue({});

    renderImportacion();
    subirArchivo();
    fireEvent.click(screen.getByRole('button', { name: 'Validar archivo' }));

    await waitFor(() => expect(screen.getByText('1 conflicto')).toBeInTheDocument());
    expect(document.querySelector('.banco-reactivos-import__result')).not.toHaveAttribute('aria-live');
    expect(screen.getByRole('button', { name: /Corrige las incidencias/i })).toBeDisabled();
    expect(screen.getByText(/Ver detalle por fila \(1\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Ver detalle por fila \(1\)/i));
    expect(await screen.findByText('· Tema: Segundo Parcial')).toBeInTheDocument();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('mantiene el flujo confirmado como borrador → revisión → publicación', async () => {
    const payload = {
      contract: 'evaluapro.reactivos.batch', schemaVersion: 1, batchId: 'test-batch',
      target: { periodoId: 'bi-1', temaIds: ['tema-bi-sp'] },
      source: { kind: 'ai_generated', generator: 'test', generatedAt: '2026-09-23T10:00:00Z' },
      items: [{ externalKey: 'reactivo-1', itemId: null, expectedVersion: null, format: 'omr.mcq5', stem: { format: 'richtext', value: 'Pregunta de prueba' },
        options: ['A', 'B', 'C', 'D', 'E'].map((key, index) => ({ key, value: `Opción ${key}`, isCorrect: index === 0 })),
        metadata: {}, provenance: { origin: 'generated', confidence: 1, notes: '' } }]
    };
    vi.spyOn(clienteApi, 'enviarFormData').mockResolvedValue({
      importId: 'imp-2',
      planHash: 'plan-123456789',
      payload,
      summary: { create: 1, noOp: 0, newVersion: 0, conflict: 0, error: 0 },
      rows: [{ line: 1, externalKey: 'bi-sp-001', operation: 'create', status: 'valid' }]
    });
    const enviar = vi.spyOn(clienteApi, 'enviar')
      .mockResolvedValueOnce({ estado: 'confirmed', draftReactivoIds: ['reactivo-1'], reactivoIds: ['reactivo-1'] })
      .mockResolvedValueOnce({ estado: 'review' })
      .mockResolvedValueOnce({ estado: 'published' });

    renderImportacion();
    subirArchivo();
    fireEvent.click(screen.getByRole('button', { name: 'Validar archivo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Enviar a revisión \(1\)/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Enviar a revisión \(1\)/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Publicar revisados \(1\)/i })).toBeInTheDocument());
    expect(screen.getByRole('list', { name: 'Pasos de importación' }).querySelector('[aria-current="step"]'))
      .toHaveTextContent('Revisa y publica');
    fireEvent.click(screen.getByRole('button', { name: /Publicar revisados \(1\)/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /Publicar revisados/i })).not.toBeInTheDocument());
    expect(enviar).toHaveBeenNthCalledWith(1, '/banco-preguntas/importaciones/imp-2/confirmar', { planHash: 'plan-123456789', payload });
    expect(enviar).toHaveBeenNthCalledWith(2, '/banco-preguntas/reactivos/reactivo-1/revisar', {});
    expect(enviar).toHaveBeenNthCalledWith(3, '/banco-preguntas/reactivos/reactivo-1/publicar', {});
  });
});
