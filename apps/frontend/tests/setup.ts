// Setup comun de pruebas React.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { instalarTestHardening } from '../../../test-utils/vitestStrict';

instalarTestHardening();

const respuestaVacia = { ok: true, json: async () => ({}), blob: async () => new Blob() };
const permisosDocenteDefault = [
  'alumnos:leer',
  'alumnos:gestionar',
  'periodos:leer',
  'periodos:gestionar',
  'periodos:archivar',
  'banco:leer',
  'banco:gestionar',
  'banco:archivar',
  'plantillas:leer',
  'plantillas:gestionar',
  'plantillas:archivar',
  'plantillas:previsualizar',
  'examenes:leer',
  'examenes:generar',
  'examenes:archivar',
  'examenes:regenerar',
  'examenes:descargar',
  'entregas:gestionar',
  'omr:analizar',
  'calificaciones:calificar',
  'calificaciones:publicar',
  'analiticas:leer',
  'sincronizacion:listar',
  'sincronizacion:exportar',
  'sincronizacion:importar',
  'sincronizacion:push',
  'sincronizacion:pull',
  'cuenta:leer',
  'cuenta:actualizar'
];
const docenteDefault = {
  id: '1',
  nombreCompleto: 'Docente',
  correo: 'docente@local.test',
  roles: ['docente'],
  permisos: permisosDocenteDefault
};

vi.stubGlobal(
  'fetch',
  vi.fn(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/salud')) {
      return { ok: true, json: async () => ({ tiempoActivo: 10 }) };
    }
    if (url.includes('/autenticacion/perfil')) {
      const override = (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__;
      return { ok: true, json: async () => ({ docente: { ...docenteDefault, ...(override ?? {}) } }) };
    }
    return respuestaVacia;
  })
);

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
  delete (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__;
});
