/**
 * gui.responsive.contract.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppAdminNegocio } from '../src/apps/app_admin_negocio/AppAdminNegocio';
import { AppAlumno } from '../src/apps/app_alumno/AppAlumno';
import { SeccionCalificaciones } from '../src/apps/app_docente/SeccionCalificaciones';
import type { PermisosUI } from '../src/apps/app_docente/tipos';
import { TemaProvider } from '../src/tema/TemaProvider';

const permisos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: true, archivar: true },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true },
  omr: { analizar: true },
  calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

describe('GUI responsive contract', () => {
  it('calificaciones conserva contenedores responsive críticos', () => {
    render(
      <TemaProvider>
        <SeccionCalificaciones
          alumnos={[]}
          onAnalizar={async () => ({})}
          onPrevisualizar={async () => ({ preview: { aciertos: 0, totalReactivos: 0 } as never })}
          resultado={null}
          onActualizar={() => {}}
          onActualizarPregunta={() => {}}
          revisionOmrConfirmada={false}
          onConfirmarRevisionOmr={() => {}}
          revisionesOmr={[]}
          examenIdActivo={null}
          paginaActiva={null}
          onSeleccionarRevision={() => {}}
          claveCorrectaPorNumero={{}}
          ordenPreguntasClave={[]}
          examenId={null}
          alumnoId={null}
          resultadoParaCalificar={null}
          respuestasParaCalificar={[]}
          onCalificar={async () => ({})}
          permisos={permisos}
          avisarSinPermiso={() => {}}
        />
      </TemaProvider>
    );

    const layout = document.querySelector('[data-calificaciones-layout="true"]');
    expect(layout).not.toBeNull();

    expect(screen.getByRole('button', { name: /Usar examen para calificación manual/i })).toBeInTheDocument();
  });

  it('alumno mantiene shell principal renderizable', () => {
    render(
      <TemaProvider>
        <AppAlumno />
      </TemaProvider>
    );

    expect(screen.getByText(/Portal Alumno/i)).toBeInTheDocument();
    expect(document.querySelector('section.card')).not.toBeNull();
  });

  it('admin negocio mantiene shell responsive principal', async () => {
    (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__ = {
      permisos: ['comercial:metricas:leer', 'comercial:tenants:leer']
    };
    render(
      <TemaProvider>
        <AppAdminNegocio />
      </TemaProvider>
    );

    expect(await screen.findByText(/Panel de Negocio EvaluaPro/i)).toBeInTheDocument();
    expect(document.querySelector('[data-admin-negocio="true"]')).not.toBeNull();
    expect(screen.getByRole('navigation', { name: /Vistas del panel de negocio/i })).toBeInTheDocument();
  });

  it('styles incluye guardas responsive globales', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles.css');
    const css = await fs.readFile(cssPath, 'utf8');

    expect(css).toContain('html,');
    expect(css).toContain('overflow-x: clip;');
    expect(css).toContain('.cabecera > :first-child');
    expect(css).toContain('.item-actions .boton');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('.opciones-grid');
    expect(css).toContain('.calificaciones-layout');
  });
});
