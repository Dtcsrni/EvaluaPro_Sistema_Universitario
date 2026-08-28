/**
 * seccionRehidratacionLotes.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionRehidratacionLotes } from '../src/apps/app_docente/SeccionRehidratacionLotes';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';
import type { Docente } from '../src/apps/app_docente/tipos';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn(),
    registrarEventosUso: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionRehidratacionLotes', () => {
  const docenteMock: Docente = {
    _id: 'doc-1',
    nombre: 'Profesor Titular',
    correo: 'profesor@cuh.mx'
  };

  const bundlesMock = [
    {
      bundleHash: 'hash-bundle-12345',
      loteId: 'lote-101',
      templateVersion: 1,
      examCount: 25,
      questionBankCount: 10,
      signatureValid: true,
      recoverable: true,
      causes: []
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ items: bundlesMock });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
  });

  it('muestra mensaje de advertencia cuando no se tienen permisos para usar el módulo', () => {
    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={false}
        puedeUsar={false}
      />
    );

    expect(screen.getByText(/Esta capacidad de rehidratacion solo esta disponible/i)).toBeInTheDocument();
  });

  it('lista bundles recuperables y permite verificar el bundle activo', async () => {
    vi.mocked(clienteApi.enviar).mockResolvedValue({
      bundleHash: 'hash-bundle-12345',
      signatureValid: true,
      templateVersion: 1,
      examCount: 25,
      questionBankCount: 10,
      recoverable: true,
      causes: []
    });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={true}
        puedeUsar={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Bundle activo: hash-bundle-12345/i)).toBeInTheDocument();
    });

    const botonVerificar = screen.getByRole('button', { name: /Verificar bundle/i });
    fireEvent.click(botonVerificar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/recuperacion/verificar', {
        bundleHash: 'hash-bundle-12345'
      });
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Verificacion de bundle' })
    );
  });

  it('permite reconstruir el lote cuando es recuperable', async () => {
    vi.mocked(clienteApi.enviar).mockResolvedValue({
      status: 'reconstruida',
      reconstructedExamIds: ['ex-1', 'ex-2'],
      reconstructedQuestionBankIds: ['preg-1'],
      conflicts: [],
      bundleHash: 'hash-bundle-12345',
      manifestHashes: ['man-1']
    });

    render(
      <SeccionRehidratacionLotes
        docente={docenteMock}
        esAdmin={true}
        puedeUsar={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Bundle activo: hash-bundle-12345/i)).toBeInTheDocument();
    });

    const botonReconstruir = screen.getByRole('button', { name: /Reconstruir lote/i });
    fireEvent.click(botonReconstruir);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/recuperacion/bundle/reconstruir', {
        bundleHash: 'hash-bundle-12345'
      });
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Reconstruccion de lote' })
    );
  });
});
