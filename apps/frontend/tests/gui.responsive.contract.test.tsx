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
  it('login prioriza el formulario en móvil y conserva el bloque informativo después', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const mobileAuth = css.slice(css.indexOf('@media (max-width: 960px)'));

    expect(mobileAuth).toMatch(/\.auth-stage-layout\s*\{[^}]*grid-template-areas:\s*"login"\s+"showcase";/);
    expect(mobileAuth).toMatch(/\.auth-showcase\s*\{[^}]*display:\s*flex;[^}]*grid-area:\s*showcase;/);
    expect(mobileAuth).toMatch(/\.auth-card-wrapper\s*\{[^}]*grid-area:\s*login;/);
    expect(mobileAuth).toMatch(/\.auth-showcase\s+\.auth-omr-mockup-card\s*\{[^}]*display:\s*none;/);
  });

  it('login compacta marca y formulario en 320 px para conservar visible la acción principal', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const narrowAuth = css.slice(css.indexOf('@media (max-width: 360px)'));

    expect(narrowAuth).toMatch(/\.auth-portal__subtitle\s*\{[^}]*display:\s*none;/);
    expect(narrowAuth).toMatch(/\.auth-card-clean\s*\{[^}]*padding:\s*0\.8rem;[^}]*gap:\s*0\.58rem;/);
    expect(narrowAuth).toMatch(/\.auth-google-status\s*\{[^}]*padding:\s*0\.45rem;/);
  });

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

  it('evaluaciones adapta la guía de cuatro vistas a una columna en móvil', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');

    expect(css).toMatch(/\.guia-materia-grid\.evaluaciones-guide-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(css).toMatch(/@media\s*\(max-width:\s*720px\)\s*\{\s*\.guia-materia-grid\.evaluaciones-guide-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  });

  it('recordatorio de asistencia ofrece un objetivo táctil de 44 por 44 px en móvil', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/components.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const mobileRules = css.split('@media (max-width: 480px)')[1] ?? '';
    const closeButton = mobileRules.match(/\.banner-recordatorio-asistencia__close\s*\{([^}]*)\}/)?.[1] ?? '';
    const primaryAction = mobileRules.match(/\.banner-recordatorio-asistencia\s*>\s*\.asistencias-btn-primario\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(closeButton).toMatch(/width:\s*44px;/);
    expect(closeButton).toMatch(/height:\s*44px;/);
    expect(primaryAction).toMatch(/min-height:\s*44px;/);
  });

  it('recordatorio de asistencia alinea texto y acciones en una fila compacta móvil', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/components.css');
    const css = await fs.readFile(cssPath, 'utf8');

    expect(css).toMatch(/@media\s*\(max-width:\s*480px\)\s*\{[^}]*\.banner-recordatorio-asistencia\s*\{[^}]*display:\s*grid;[^}]*grid-template-areas:\s*"text action close"/);
    expect(css).toMatch(/\.banner-recordatorio-asistencia__text\s*\{[^}]*grid-area:\s*text;[^}]*min-width:\s*0;/);
    expect(css).toMatch(/\.banner-recordatorio-asistencia\s*>\s*\.asistencias-btn-primario\s*\{[^}]*grid-area:\s*action;/);
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
    const mobileCardsCss = css;

    expect(mobileCardsCss).toMatch(
      /\.calificaciones-consulta__table tbody tr\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/
    );
    expect(mobileCardsCss).toMatch(/\.calificaciones-consulta__table tbody td\[colspan\]\s*\{\s*grid-column:\s*1\s*\/\s*-1;/);
    expect(css).toMatch(/\.calificaciones-workspace-nav strong,\s*\.calificaciones-workspace-nav small\s*\{[^}]*overflow-wrap:\s*normal;[^}]*word-break:\s*normal;/);
    expect(css).toMatch(/@media\s*\(max-width:\s*860px\)\s*\{\s*\.calificaciones-workspace-nav\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(css).toMatch(/@media\s*\(min-width:\s*861px\)\s*and\s*\(max-width:\s*1440px\)\s*\{\s*\.calificaciones-workspace-nav\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
    expect(css).toMatch(/@media\s*\(max-width:\s*480px\)\s*\{\s*\.calificaciones-workspace-nav\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(css).toMatch(/@media\s*\(min-width:\s*361px\)\s*and\s*\(max-width:\s*480px\)\s*\{\s*\.calificaciones-workspace-nav\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);\s*\}\s*\.calificaciones-workspace-nav button:last-child\s*\{\s*grid-column:\s*1\s*\/\s*-1;/);
    expect(css).toMatch(/@media\s*\(max-width:\s*360px\)\s*\{[\s\S]*?\.calificaciones-workspace-nav__mobile-label\s*\{\s*display:\s*block;/);
    expect(css).toMatch(/\.calificaciones-workspace-nav__mobile-select\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?\}/);
    expect(css).toMatch(/\.calificaciones-workspace-nav__desktop\s*\{\s*display:\s*none;/);
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
    const cardCssPath = path.resolve(process.cwd(), 'src/styles/cards.css');
    const cardCss = await fs.readFile(cardCssPath, 'utf8');
    const desktopHeader = cardCss.slice(cardCss.indexOf('@media (min-width: 1180px)'));

    expect(css).toMatch(/\.shell-docente__content\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*min-width:\s*0;/);
    expect(desktopOverride).toMatch(/\.shell-docente__content\s*>\s*\.panel\s*\{[^}]*grid-template-columns:\s*240px\s+1fr;/);
    expect(desktopHeader).toMatch(/\.shell-docente__header\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*max-content\);/);
    expect(desktopHeader).toMatch(/\.shell-docente__acciones\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*flex-wrap:\s*nowrap;/);
    expect(desktopHeader).toMatch(/\.shell-docente__controles\s*\{[^}]*flex:\s*0\s+0\s+auto;/);
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

  it('conserva indicadores legibles a 320 px y equilibra el resumen en móviles mayores', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const narrowAccountCss = css.slice(css.lastIndexOf('@media (max-width: 340px)'));
    const compactAccountCss = css.slice(css.lastIndexOf('@media (min-width: 341px) and (max-width: 720px)'));

    expect(narrowAccountCss).toMatch(/\.cuenta-panel \.banco-header-kpis\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(narrowAccountCss).toMatch(/\.cuenta-panel \.banco-mini-kpi:last-child\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/);
    expect(narrowAccountCss).toMatch(/\.cuenta-panel \.banco-mini-kpi__lbl\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*width:\s*100%;[^}]*overflow-wrap:\s*anywhere;/);
    expect(narrowAccountCss).toMatch(/\.cuenta-panel \.banco-mini-kpi__num\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*width:\s*100%;[^}]*overflow-wrap:\s*normal;/);
    expect(narrowAccountCss).toMatch(/\.cuenta-panel \.banco-mini-kpi__num--sm\s*\{[^}]*font-size:\s*0\.72rem !important;[^}]*overflow-wrap:\s*normal;/);
    expect(narrowAccountCss).toMatch(/:root\[data-theme="dark"\] \.materias-panel__title\s*\{[^}]*font-size:\s*1\.35rem;/);
    expect(compactAccountCss).toMatch(/\.cuenta-panel \.banco-mini-kpi:nth-child\(5\)\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/);
  });

  it('mantiene contraste legible para los indicadores de Cuenta en tema claro', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const lightThemeCss = css.slice(css.indexOf('/* WCAG AA: texto de KPI de Cuenta'));
    const accountOverrides = lightThemeCss.slice(0, lightThemeCss.indexOf('/* Mini KPI color & font modifiers'));

    expect(accountOverrides).toMatch(/\.cuenta-panel \.banco-mini-kpi__lbl\s*\{[^}]*color:\s*#334155;/);
    expect(accountOverrides).toMatch(/\.cuenta-panel \.banco-mini-kpi--preguntas \.banco-mini-kpi__num\s*\{[^}]*color:\s*#6b21a8 !important;/);
    expect(accountOverrides).toMatch(/\.cuenta-panel \.banco-mini-kpi__num--emerald\s*\{[^}]*color:\s*#065f46 !important;/);
    expect(accountOverrides).toMatch(/\.cuenta-panel \.banco-mini-kpi__num--amber\s*\{[^}]*color:\s*#92400e !important;/);
    expect(accountOverrides).toMatch(/\.cuenta-panel \.banco-mini-kpi__num--sky\s*\{[^}]*color:\s*#075985 !important;/);
    expect(accountOverrides).toMatch(/\.cuenta-panel \.banco-mini-kpi__num--slate\s*\{[^}]*color:\s*#475569 !important;/);
  });

  it('usa el token semántico de texto para rótulos compartidos de KPI', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const kpiLabel = css.match(/\.banco-mini-kpi__lbl\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(kpiLabel).toMatch(/color:\s*var\(--ui-text-secondary\);/);
    expect(kpiLabel).not.toMatch(/#94a3b8/);
  });

  it('mantiene contraste en valores KPI de Sincronización sin quitar los acentos de icono', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const syncKpi = css.match(/\.sincronizacion-shell \.sincronizacion-header-kpis \.banco-mini-kpi__num\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(syncKpi).toMatch(/color:\s*var\(--ui-text-primary\) !important;/);
    expect(syncKpi).toMatch(/text-shadow:\s*none;/);
    expect(css).toMatch(/\.banco-mini-kpi--(?:preguntas|temas|temaactual|paginas) \.banco-mini-kpi__icon\s*\{\s*color:/);
  });

  it('apila los controles de logotipo PDF para conservar ancho legible en sus campos', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const logoField = css.match(/\.cuenta-pdf__logo-field\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(logoField).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(logoField).toMatch(/align-items:\s*stretch;/);
  });

  it('mantiene el error de resumen y su reintento usables en pantallas pequeñas', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/screens.css');
    const css = await fs.readFile(cssPath, 'utf8');

    expect(css).toMatch(/\.alumnos-resumen-asistencias-error\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*align-items:\s*center;/);
    expect(css).toMatch(/\.alumnos-resumen-asistencias-error \.mensaje\s*\{[^}]*flex:\s*1\s+1\s+24rem;/);
    expect(css).toMatch(/@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.alumnos-resumen-asistencias-error \.boton\s*\{\s*width:\s*100%;/);
    expect(css).toMatch(/\.alumnos-panel \.materia-mini-kpi__lbl\s*\{[^}]*overflow-wrap:\s*normal;[^}]*word-break:\s*normal;/);
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

  it('toast usa superficie opaca del tema y evita efectos de orbe', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const toast = css.slice(css.indexOf('.toast {'), css.indexOf('.toast.ok'));
    const toastMobile = css.slice(css.indexOf('@media (max-width: 520px)'));
    const cardsCss = await fs.readFile(path.resolve(process.cwd(), 'src/styles/cards.css'), 'utf8');

    expect(toast).toContain('background: var(--superficieSolida);');
    expect(toast).toContain('border-radius: 8px;');
    expect(toast).not.toMatch(/radial-gradient|backdrop-filter/);
    expect(cardsCss).not.toMatch(/\.toast-icon/);
    expect(toastMobile).toMatch(
      /\.toast-viewport:not\(\[data-placement="flow"\]\)\s*\{[^}]*max-height:\s*min\(50dvh, calc\(100dvh - 20px\)\);/
    );
    expect(toastMobile).toMatch(
      /\.toast-viewport\[data-placement="flow"\]\s*\{[^}]*position:\s*relative;[^}]*inset:\s*auto;/
    );
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
      /\.calificaciones-experience \.banco-header-kpis\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/
    );
    expect(mobileCss).toMatch(
      /\.calificaciones-experience \.banco-mini-kpi--reactivos\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-template-columns:\s*auto auto minmax\(0,\s*1fr\);/
    );
  });

  it('mantiene contraste y forma de insignia en la guía de módulos en tema claro', async () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/cards.css');
    const css = await fs.readFile(cssPath, 'utf8');

    expect(css).toMatch(
      /:root:not\(\[data-theme="dark"\]\) \.guia-materia-badge\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--screen-accent, #38bdf8\) 14%, white\) !important;[^}]*color:\s*#0f172a !important;/
    );
  });
});
