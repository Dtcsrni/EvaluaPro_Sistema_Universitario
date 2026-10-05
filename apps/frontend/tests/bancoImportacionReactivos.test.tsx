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

function subirArchivo() {
  const archivo = new File(['{}'], 'reactivos.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('Archivo de reactivos'), { target: { files: [archivo] } });
}

describe('BancoImportacionReactivos', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mantiene el flujo inicial simple y exige archivo antes de validar', () => {
    renderImportacion();

    expect(screen.getByRole('heading', { name: 'Importar reactivos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validar archivo' })).toBeDisabled();
    expect(screen.getByText(/Contrato v1 · cinco opciones A–E/i)).toBeInTheDocument();
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
    expect(screen.queryByText('ia-otra-materia')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver filas (1)'));
    expect(await screen.findByText(/bi-001 — create \(applied\)/)).toBeInTheDocument();
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
    expect(screen.getByText(/1 en cuarentena/)).toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText('1 conflictos')).toBeInTheDocument());
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
    fireEvent.click(screen.getByRole('button', { name: /Publicar revisados \(1\)/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /Publicar revisados/i })).not.toBeInTheDocument());
    expect(enviar).toHaveBeenNthCalledWith(1, '/banco-preguntas/importaciones/imp-2/confirmar', { planHash: 'plan-123456789', payload });
    expect(enviar).toHaveBeenNthCalledWith(2, '/banco-preguntas/reactivos/reactivo-1/revisar', {});
    expect(enviar).toHaveBeenNthCalledWith(3, '/banco-preguntas/reactivos/reactivo-1/publicar', {});
  });
});
