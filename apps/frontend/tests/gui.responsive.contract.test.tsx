/**
 * gui.responsive.contract.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('materias reduce la columna implícita y encoge sus bloques en móvil', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');

    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*?\.materias-panel\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*min-width:\s*0;/
    );
    expect(css).toMatch(
      /\.materias-panel\s*>\s*:is\(\.materias-panel__head,\s*\.guia-materia-compact,\s*\.materias-form,\s*\.materias-seccion-activas\)\s*\{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*max-width:\s*100%;/
    );
    expect(css).toMatch(
      /\.materias-panel__meta-row,\s*\.materias-header-actions,\s*\.materias-header-kpis\s*\{[^}]*flex-wrap:\s*wrap;/
    );
  });

  it('recordatorio de asistencia conserva un objetivo táctil de al menos 24 por 24 px', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/components.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const closeButton = css.match(/\.banner-recordatorio-asistencia__close\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(closeButton).toMatch(/width:\s*2rem;/);
    expect(closeButton).toMatch(/height:\s*2rem;/);
    expect(closeButton).toMatch(/min-width:\s*24px;/);
    expect(closeButton).toMatch(/min-height:\s*24px;/);
  });

  it('calificaciones conserva contenedores responsive críticos', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    const layout = document.querySelector('[data-calificaciones-layout="true"]');
    expect(layout).not.toBeNull();

    expect(screen.getByRole('button', { name: /Usar examen para calificación manual/i })).toBeInTheDocument();
  });

  it('calificaciones mantiene vistas internas y navegación dentro del ancho en móvil', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const mobileCss = css.slice(css.lastIndexOf('@media (max-width: 720px)'));

    expect(mobileCss).toMatch(
      /\.calificaciones-experience > \*\s*\{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*max-width:\s*100%;/
    );
    expect(mobileCss).toMatch(
      /\.calificaciones-experience > \.calif-panel__head\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
    );
    expect(mobileCss).toMatch(
      /\.calificaciones-experience \.calificaciones-workspace-nav\s*\{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*max-width:\s*100%;/
    );
    expect(mobileCss).toMatch(
      /\.calificaciones-workspace-view > \*\s*\{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*max-width:\s*100%;/
    );
    expect(mobileCss).toMatch(
      /\.calif-action-deck\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*min-width:\s*0;[^}]*width:\s*100%;/
    );
    expect(mobileCss).toMatch(
      /\.calif-deck-card__field\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%;/
    );
  });

  it('calificaciones muestra las filas como fichas antes de comprimir columnas en móvil', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/cards.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const mobileCardsCss = css.slice(css.lastIndexOf('@media (max-width: 860px)'));

    expect(mobileCardsCss).toMatch(
      /\.calificaciones-consulta__table tbody tr\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/
    );
    expect(mobileCardsCss).toMatch(/\.calificaciones-consulta__table tbody td\[colspan\]\s*\{\s*grid-column:\s*1\s*\/\s*-1;/);
    expect(css).toMatch(/@media\s*\(max-width:\s*860px\)\s*\{\s*\.calificaciones-workspace-nav\s*\{\s*grid-template-columns:\s*1fr;/);
  });

  it('oculta visualmente el caption sin quitarlo del árbol accesible en tablas de calificaciones', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/cards.css');
    const css = await fs.readFile(cssPath, 'utf8');

    expect(css).toMatch(
      /\.calificaciones-consulta\s+\.sr-only\s*\{[^}]*position:\s*absolute;[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\);/
    );
  });

  it('mantiene el shell docente en una columna que puede encogerse en móvil', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const desktopOverride = css.slice(css.indexOf('@media (min-width: 1024px)'));

    expect(css).toMatch(/\.shell-docente__content\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*min-width:\s*0;/);
    expect(desktopOverride).toMatch(/\.shell-docente__content\s*>\s*\.panel\s*\{[^}]*grid-template-columns:\s*240px\s+1fr;/);
  });

  it('repliega el resumen de Cuenta sin ancho mínimo que recorte su contenido', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const mobileAccountCss = css.slice(css.lastIndexOf('@media (max-width: 720px)'));

    expect(mobileAccountCss).toMatch(
      /\.cuenta-panel\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*min-width:\s*0;/
    );
    expect(mobileAccountCss).toMatch(
      /\.cuenta-panel__head\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*min-width:\s*0;/
    );
    expect(mobileAccountCss).toMatch(
      /\.cuenta-panel \.banco-header-kpis\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*8rem\),\s*1fr\)\);/
    );
    expect(mobileAccountCss).toMatch(
      /\.cuenta-panel \.banco-mini-kpi\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/
    );
    expect(mobileAccountCss).toMatch(
      /\.cuenta-panel \.cuenta-subpanel\s*\{[^}]*box-sizing:\s*border-box;[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*padding:\s*1rem;/
    );
    expect(mobileAccountCss).toMatch(
      /\.cuenta-panel \.banco-section-title\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
    );
    expect(mobileAccountCss).toMatch(
      /\.cuenta-panel \.acciones\s*\{[^}]*flex-wrap:\s*wrap;/
    );
  });

  it('apila los indicadores de Cuenta en anchos de 360 px o menos', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const narrowAccountCss = css.slice(css.lastIndexOf('@media (max-width: 360px)'));

    expect(narrowAccountCss).toMatch(
      /\.cuenta-panel \.banco-header-kpis\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
    );
  });

  it('repliega Alumnos, formularios y filtros dentro del ancho del shell en móvil', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const mobileCss = css.slice(css.lastIndexOf('@media (max-width: 720px)'));

    expect(mobileCss).toMatch(
      /\.alumnos-panel > :is\(\.alumnos-panel__head, \.alumnos-form, \.alumnos-explorador, \.alumnos-lista\)\s*\{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*max-width:\s*100%;/
    );
    expect(mobileCss).toMatch(
      /\.alumnos-panel__lead\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*44px minmax\(0, 1fr\);[^}]*min-width:\s*0;/
    );
    expect(mobileCss).toMatch(
      /\.alumnos-form--glass,\s*\.alumnos-filtros--glass\s*\{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*max-width:\s*100%;/
    );
    expect(mobileCss).toMatch(
      /\.alumno-avatar\s*\{[^}]*flex:\s*0 0 44px;[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*min-width:\s*44px;/
    );
    expect(mobileCss).toMatch(
      /\.alumnos-lista\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
    );
    expect(mobileCss).toMatch(
      /\.alumnos-lista > li,\s*\.alumnos-lista > li > \.item-glass\s*\{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*max-width:\s*100%;/
    );
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

  it('plantillas evita cortar tabs en mobile y permite que sus etiquetas envuelvan', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');

    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*?\.plantillas-shell \.plantillas-tabs-bar\s*\{[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?overflow:\s*visible;/
    );
    expect(css).toMatch(
      /\.plantillas-shell \.plantillas-tab-btn\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/
    );
    expect(css).toMatch(
      /\.banco-panel__lead\s*\{[\s\S]*?align-items:\s*flex-start;[\s\S]*?gap:\s*0\.75rem;/
    );
    expect(css).toMatch(
      /\.banco-panel__title\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/
    );
  });

  it('mantiene el selector de navegación docente visible y ancho completo hasta 1023 px', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const mobileNavCss = css.slice(css.lastIndexOf('@media (max-width: 1023px)'));
    const desktopNavCss = css.slice(css.lastIndexOf('@media (min-width: 1024px)'));

    expect(mobileNavCss).toMatch(
      /\.shell-docente__content\s*>\s*\.panel\s*>\s*\.tabs--docente-responsive\s*\{[^}]*display:\s*grid;[^}]*overflow:\s*visible;/
    );
    expect(mobileNavCss).toMatch(
      /\.tabs--docente-responsive \.tabs__mobile-picker select\s*\{[^}]*width:\s*100%;[^}]*min-height:\s*44px;/
    );
    expect(mobileNavCss).toMatch(
      /\.tabs--docente-responsive\s*>\s*\.tab\s*\{\s*display:\s*none;/
    );
    expect(desktopNavCss).toMatch(
      /\.tabs--docente-responsive \.tabs__mobile-picker\s*\{\s*display:\s*none;/
    );
  });

  it('refluye las métricas de Calificaciones a columnas legibles en móvil', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const mobileCss = css.slice(css.lastIndexOf('@media (max-width: 720px)'));

    expect(mobileCss).toMatch(
      /\.calificaciones-experience \.banco-header-kpis\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*8rem\),\s*1fr\)\);/
    );
  });
});
