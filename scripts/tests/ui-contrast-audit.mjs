import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cssPath = path.join(repoRoot, 'apps/frontend/src/styles/cards.css');
const readCss = (filePath) => fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
const css = readCss(cssPath);
const appStylesCss = readCss(path.join(repoRoot, 'apps/frontend/src/styles.css'));
const screensCss = readCss(path.join(repoRoot, 'apps/frontend/src/styles/screens.css'));
const foundationsCss = readCss(path.join(repoRoot, 'apps/frontend/src/styles/foundations.css'));

function channelToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const normalized = hex.replace('#', '');
  assert.match(normalized, /^[0-9a-f]{6}$/i, `color inválido: ${hex}`);
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  const [red, green, blue] = channels.map(channelToLinear);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

const checks = [
  { id: 'icon-field-light-on-dark-input', foreground: '#64748b', background: '#061326', minimum: 3 },
  { id: 'icon-field-dark-on-dark-input', foreground: '#94a3b8', background: '#061326', minimum: 3 },
  { id: 'plantillas-light-selected-chip', foreground: '#6259b8', background: '#f1f5f9', minimum: 4.5 },
  { id: 'plantillas-light-icon-orb', foreground: '#b4233e', background: '#f8e8f0', minimum: 3 },
  { id: 'status-icon-dark-on-card', foreground: '#f8fbff', background: '#102a46', minimum: 3 },
  { id: 'status-text-dark-on-card', foreground: '#d9e8f5', background: '#102a46', minimum: 4.5 },
  { id: 'status-text-light-on-card', foreground: '#334e68', background: '#f8fafc', minimum: 4.5 },
  { id: 'dark-heading-on-card', foreground: '#f8fbff', background: '#214464', minimum: 4.5 },
  { id: 'dark-supporting-on-card', foreground: '#d9e8f5', background: '#214464', minimum: 4.5 },
  { id: 'dark-muted-on-card', foreground: '#c8d8eb', background: '#214464', minimum: 4.5 },
  { id: 'dark-placeholder-on-input', foreground: '#b9cfe2', background: '#061326', minimum: 4.5 },
  { id: 'dark-heading-on-panel', foreground: '#f8fbff', background: '#102a46', minimum: 4.5 },
  { id: 'dark-supporting-on-panel', foreground: '#d9e8f5', background: '#102a46', minimum: 4.5 },
  { id: 'light-heading-on-card', foreground: '#0f172a', background: '#ffffff', minimum: 4.5 },
  { id: 'temarios-dark-title', foreground: '#f5f9ff', background: '#214464', minimum: 4.5 },
  { id: 'temarios-light-title', foreground: '#0f172a', background: '#ffffff', minimum: 4.5 },
  { id: 'temarios-light-amber-copy', foreground: '#b45309', background: '#fef4e2', minimum: 4.5 },
  { id: 'temarios-light-hover-outline', foreground: '#d97706', background: '#ffffff', minimum: 3 },
  { id: 'temarios-light-upload-outline', foreground: '#9a5b00', background: '#eef4fa', minimum: 3 },
  { id: 'temarios-light-upload-hover-outline', foreground: '#9a5b00', background: '#eef4fa', minimum: 3 },
  { id: 'temarios-dark-upload-outline', foreground: '#ffd166', background: '#07162b', minimum: 3 },
  { id: 'temarios-dark-upload-hover-outline', foreground: '#ffd166', background: '#07162b', minimum: 3 },
  { id: 'light-supporting-on-card', foreground: '#334155', background: '#ffffff', minimum: 4.5 },
  { id: 'light-muted-on-card', foreground: '#475569', background: '#ffffff', minimum: 4.5 },
  { id: 'dark-primary-button', foreground: '#ffffff', background: '#0b6fa8', minimum: 4.5 },
  { id: 'dark-primary-button-hover', foreground: '#ffffff', background: '#0878b4', minimum: 4.5 },
  { id: 'dark-secondary-button', foreground: '#f8fbff', background: '#234869', minimum: 4.5 },
  { id: 'dark-materias-count', foreground: '#122326', background: '#75b4ba', minimum: 4.5 },
  { id: 'dark-step-number', foreground: '#d9e8f5', background: '#075e91', minimum: 4.5 },
  { id: 'dark-step-arrow', foreground: '#d9e8f5', background: '#102a46', minimum: 4.5 },
  { id: 'asistencia-arrow-light', foreground: '#087ea4', background: '#ffffff', minimum: 3 },
  { id: 'asistencia-arrow-dark', foreground: '#43d9ff', background: '#172a4d', minimum: 3 },
  { id: 'temarios-light-icon', foreground: '#9a5b00', background: '#e1ddd5', minimum: 3 },
  { id: 'dark-stepper-disabled', foreground: '#c8d8eb', background: '#334e68', minimum: 4.5 },
  { id: 'light-primary-button', foreground: '#ffffff', background: '#0b6fa8', minimum: 4.5 },
  { id: 'light-primary-button-hover', foreground: '#ffffff', background: '#075e91', minimum: 4.5 },
  { id: 'light-secondary-button', foreground: '#102033', background: '#f4f8fb', minimum: 4.5 },
  { id: 'light-step-arrow', foreground: '#334155', background: '#f1f5f9', minimum: 4.5 },
  { id: 'light-navigation', foreground: '#16303a', background: '#ffffff', minimum: 4.5 },
  { id: 'light-navigation-active', foreground: '#ffffff', background: '#0b6fa8', minimum: 4.5 },
  { id: 'light-kpi-questions', foreground: '#7e22ce', background: '#ffffff', minimum: 4.5 },
  { id: 'light-kpi-topics', foreground: '#0369a1', background: '#ffffff', minimum: 4.5 },
  { id: 'light-kpi-current-topic', foreground: '#047857', background: '#ffffff', minimum: 4.5 },
  { id: 'light-kpi-pages', foreground: '#4338ca', background: '#ffffff', minimum: 4.5 },
  { id: 'materias-light-kpi-active', foreground: '#075985', background: '#eef4fa', minimum: 4.5 },
  { id: 'materias-light-kpi-groups', foreground: '#065f46', background: '#eef4fa', minimum: 4.5 },
  { id: 'materias-light-kpi-closing', foreground: '#92400e', background: '#eef4fa', minimum: 4.5 },
  { id: 'materias-light-kpi-label', foreground: '#475569', background: '#eef4fa', minimum: 4.5 },
  { id: 'materias-light-empty-roster', foreground: '#334155', background: '#f1f5f9', minimum: 4.5 },
  { id: 'materias-light-meta-label', foreground: '#475569', background: '#f8fafc', minimum: 4.5 },
  { id: 'materias-light-meta-value', foreground: '#0f172a', background: '#f8fafc', minimum: 4.5 },
  { id: 'materias-light-roster-count', foreground: '#075985', background: '#f8fafc', minimum: 4.5 },
  { id: 'materias-light-period-in-course', foreground: '#0f172a', background: '#dcfce7', minimum: 4.5 },
  { id: 'materias-light-period-upcoming', foreground: '#0f172a', background: '#f2fafa', minimum: 4.5 },
  { id: 'materias-light-period-closing', foreground: '#0f172a', background: '#ffedd5', minimum: 4.5 },
  { id: 'materias-light-period-completed', foreground: '#0f172a', background: '#dcfce7', minimum: 4.5 },
  { id: 'materias-dark-period-in-course', foreground: '#a7f3d0', background: '#3f504e', minimum: 4.5 },
  { id: 'materias-dark-period-upcoming', foreground: '#e0f2fe', background: '#3f4c55', minimum: 4.5 },
  { id: 'materias-dark-period-closing', foreground: '#fef08a', background: '#594d3a', minimum: 4.5 },
  { id: 'materias-dark-period-completed', foreground: '#a7f3d0', background: '#3f504e', minimum: 4.5 },
  { id: 'calificaciones-light-kpi-primary', foreground: '#6b21a8', background: '#e2e8f0', minimum: 4.5 },
  { id: 'calificaciones-light-kpi-info', foreground: '#075985', background: '#e2e8f0', minimum: 4.5 },
  { id: 'calificaciones-light-kpi-warning', foreground: '#92400e', background: '#e2e8f0', minimum: 4.5 },
  { id: 'calificaciones-light-kpi-success', foreground: '#065f46', background: '#e2e8f0', minimum: 4.5 },
  { id: 'calificaciones-light-status-complete', foreground: '#14532d', background: '#dbebe9', minimum: 4.5 },
  { id: 'calificaciones-dark-status-complete', foreground: '#a7f3d0', background: '#3f504e', minimum: 4.5 },
  { id: 'calificaciones-light-kpi-secondary', foreground: '#3730a3', background: '#e2e8f0', minimum: 4.5 },
  { id: 'calificacion-permission-light', foreground: '#9a5b00', background: '#f8fafc', minimum: 4.5 },
  { id: 'calificacion-permission-dark', foreground: '#ffd166', background: '#0d1b34', minimum: 4.5 },
  { id: 'entrega-light-kpi-primary', foreground: '#6b21a8', background: '#eef4fa', minimum: 4.5 },
  { id: 'entrega-light-kpi-success', foreground: '#065f46', background: '#eef4fa', minimum: 4.5 },
  { id: 'entrega-light-kpi-warning', foreground: '#92400e', background: '#eef4fa', minimum: 4.5 },
  { id: 'entrega-light-kpi-progress', foreground: '#075985', background: '#eef4fa', minimum: 4.5 },
  { id: 'evaluaciones-light-kpi-primary', foreground: '#6b21a8', background: '#eef4fa', minimum: 4.5 },
  { id: 'evaluaciones-light-kpi-info', foreground: '#075985', background: '#eef4fa', minimum: 4.5 },
  { id: 'evaluaciones-light-kpi-success', foreground: '#065f46', background: '#eef4fa', minimum: 4.5 },
  { id: 'light-section-pill-violet', foreground: '#6b21a8', background: '#f3e8ff', minimum: 4.5 },
  { id: 'light-section-pill-amber', foreground: '#92400e', background: '#fffbeb', minimum: 4.5 },
  { id: 'light-section-pill-cyan', foreground: '#155e75', background: '#cffafe', minimum: 4.5 },
  { id: 'light-section-pill-emerald', foreground: '#065f46', background: '#d1fae5', minimum: 4.5 },
  { id: 'light-section-pill-sky', foreground: '#075985', background: '#e0f2fe', minimum: 4.5 },
  { id: 'dark-format-panel-body', foreground: '#e2e8f0', background: '#1e293b', minimum: 4.5 },
  { id: 'dark-format-panel-heading', foreground: '#f8fafc', background: '#1e293b', minimum: 4.5 },
  { id: 'dark-format-panel-supporting', foreground: '#cbd5e1', background: '#1e293b', minimum: 4.5 },
  { id: 'dark-format-panel-accent', foreground: '#67e8f9', background: '#1e293b', minimum: 4.5 },
  { id: 'toast-light-title', foreground: '#0f172a', background: '#ffffff', minimum: 4.5 },
  { id: 'toast-light-message', foreground: '#1e293b', background: '#ffffff', minimum: 4.5 },
  { id: 'toast-light-supporting', foreground: '#64748b', background: '#ffffff', minimum: 4.5 },
  { id: 'toast-dark-title', foreground: '#f1f5f9', background: '#060e24', minimum: 4.5 },
  { id: 'toast-dark-message', foreground: '#e2e8f0', background: '#060e24', minimum: 4.5 },
  { id: 'toast-dark-supporting', foreground: '#94a3b8', background: '#060e24', minimum: 4.5 },
  { id: 'auth-light-title-on-gradient-base', foreground: '#0f172a', background: '#e2e8f0', minimum: 4.5 },
  { id: 'auth-light-supporting-on-gradient-base', foreground: '#1e293b', background: '#e2e8f0', minimum: 4.5 },
  { id: 'auth-light-badge-text-on-opaque-surface', foreground: '#0d5052', background: '#ffffff', minimum: 4.5 },
  { id: 'auth-light-badge-boundary-on-gradient-base', foreground: '#0d5052', background: '#e2e8f0', minimum: 3 },
  { id: 'auth-password-meter-short-light', foreground: '#7a1515', background: '#ffffff', minimum: 3 },
  { id: 'auth-password-meter-minimum-light', foreground: '#7c2d12', background: '#ffffff', minimum: 3 },
  { id: 'auth-password-meter-good-light', foreground: '#1459c7', background: '#ffffff', minimum: 3 },
  { id: 'auth-password-meter-strong-light', foreground: '#14532d', background: '#ffffff', minimum: 3 },
  { id: 'auth-password-meter-short-dark', foreground: '#fecaca', background: '#060e24', minimum: 3 },
  { id: 'auth-password-meter-minimum-dark', foreground: '#fef08a', background: '#060e24', minimum: 3 },
  { id: 'auth-password-meter-good-dark', foreground: '#38bdf8', background: '#060e24', minimum: 3 },
  { id: 'auth-password-meter-strong-dark', foreground: '#a7f3d0', background: '#060e24', minimum: 3 },
];

assert.match(css, /--muted:\s*#c8d8eb/);
assert.match(css, /color:\s*#f8fbff\s*!important/);
assert.match(css, /color:\s*#d9e8f5\s*!important/);
assert.match(css, /color:\s*#b9cfe2\s*!important/);
assert.match(foundationsCss, /--ui-canvas:\s*#07162b/);
assert.match(foundationsCss, /--ui-text-primary:\s*#f8fbff/);
assert.match(foundationsCss, /--ui-button-primary-bg:\s*#0b6fa8/);
assert.match(foundationsCss, /--ui-accent-warning:\s*#9a5b00/);
assert.match(foundationsCss, /--ui-accent-warning:\s*#ffd166/);
assert.match(appStylesCss, /\.calif-grade-card #calificar-permiso-ayuda \.mensaje\.warning,[\s\S]*\.calificaciones-manual-panel #calificar-manual-permiso-ayuda \.mensaje\.warning\s*\{[\s\S]*background:\s*var\(--surface-1\)[\s\S]*color:\s*var\(--ui-accent-warning\)/);
assert.match(screensCss, /\.auth-input-box__icon\s*\{[^}]*color:\s*var\(--muted\)/);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.plantillas-tema-chip--selected\s*\{[^}]*border-color:\s*var\(--ui-accent-secondary\)[^}]*color:\s*var\(--ui-accent-secondary\)/);
assert.match(screensCss, /\.entrega-panel__icon-orb\s*\{[^}]*color:\s*var\(--ui-text-primary\)/);
assert.match(screensCss, /\.calificaciones-panel__icon-orb\s*\{[^}]*color:\s*var\(--ui-text-primary\)/);
assert.match(screensCss, /\.evaluaciones-panel__icon-orb\s*\{[^}]*color:\s*var\(--ui-text-primary\)/);
assert.match(css, /--ui-card-blur:\s*var\(--ui-glass-blur\)/);
assert.match(css, /background:\s*linear-gradient\(112deg/);
assert.match(css, /materia-card-alumnos__header strong[\s\S]*color:\s*#122326\s*!important[\s\S]*background:\s*#75b4ba\s*!important/);
assert.match(css, /empty-step__num[\s\S]*color:\s*#f8fbff\s*!important[\s\S]*background:\s*#075e91\s*!important/);
assert.match(css, /empty-step__arrow[\s\S]*color:\s*#d9e8f5\s*!important/);
assert.match(css, /plantillas-stepper__button:disabled[\s\S]*color:\s*#c8d8eb\s*!important[\s\S]*background:\s*#334e68\s*!important[\s\S]*opacity:\s*1\s*!important/);
assert.match(appStylesCss, /\.toast\s*\{[^}]*background:\s*var\(--superficieSolida\)/);
assert.match(appStylesCss, /\.toast-title\s*\{[^}]*color:\s*var\(--texto\)/);
assert.match(appStylesCss, /\.toast-text\s*\{[^}]*color:\s*var\(--textoSuave\)/);
assert.match(appStylesCss, /:root\[data-theme="dark"\][\s\S]*?--texto:\s*#f1f5f9;[\s\S]*?--textoSuave:\s*#e2e8f0;[\s\S]*?--muted:\s*#94a3b8;[\s\S]*?--superficieSolida:\s*#060e24;/);
assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.tabs \.tab[\s\S]*color:\s*#16303a\s*!important/);
assert.match(css, /tabs \.tab\.activa[\s\S]*color:\s*#ffffff\s*!important[\s\S]*background:\s*#0b6fa8\s*!important/);
assert.match(css, /WCAG AA:[\s\S]{0,800}\.banco-mini-kpi--temas \.banco-mini-kpi__num/);
assert.match(screensCss, /WCAG AA:[\s\S]{0,500}\.plantillas-formato-box\s*\{/);
assert.match(screensCss, /WCAG AA:[\s\S]{0,500}\.plantillas-form--panoramico \.plantillas-formato-box\s*\{/);
assert.match(css, /calificaciones-experience \.banco-mini-kpi--preguntas \.banco-mini-kpi__num[\s\S]{0,180}color:\s*#6b21a8\s*!important/);
assert.match(css, /calificaciones-experience \.banco-mini-kpi--paginas \.banco-mini-kpi__num--cyan[\s\S]{0,180}color:\s*#075985\s*!important/);
assert.match(css, /calificaciones-experience \.banco-mini-kpi--sintema \.banco-mini-kpi__num--amber[\s\S]{0,180}color:\s*#92400e\s*!important/);
assert.match(css, /calificaciones-experience \.banco-mini-kpi--temaactual \.banco-mini-kpi__num--emerald[\s\S]{0,180}color:\s*#065f46\s*!important/);
assert.match(css, /\.calificaciones-consulta__status\.is-complete\s*\{[^}]*color:\s*var\(--exitoTexto\)/);
assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.calificaciones-consulta__status\.is-complete\s*\{\s*color:\s*var\(--exitoTexto\)\s*;/);
assert.match(css, /calificaciones-experience \.banco-mini-kpi--reactivos \.banco-mini-kpi__num[\s\S]{0,180}color:\s*#3730a3\s*!important/);
assert.match(screensCss, /WCAG AA: valores KPI e iconos de Entrega[\s\S]{0,500}color:\s*#6b21a8\s*!important/);
assert.match(screensCss, /\.entrega-header-kpis \.banco-mini-kpi--temaactual[\s\S]{0,180}color:\s*#065f46\s*!important/);
assert.match(screensCss, /\.entrega-header-kpis \.banco-mini-kpi--sintema[\s\S]{0,180}color:\s*#92400e\s*!important/);
assert.match(screensCss, /\.entrega-header-kpis \.banco-mini-kpi--paginas[\s\S]{0,180}color:\s*#075985\s*!important/);
assert.match(screensCss, /WCAG AA: valores e iconos KPI de Evaluaciones[\s\S]{0,700}color:\s*#6b21a8\s*!important/);
for (const declaration of [
  ':root:not([data-theme="dark"]) .banco-section-pill',
  'background: #f3e8ff;\n  border-color: #d8b4fe;\n  color: #6b21a8;',
  '.banco-section-pill--amber', 'background: #fffbeb;\n  border-color: #fcd34d;\n  color: #92400e;',
  '.banco-section-pill--cyan', 'background: #cffafe;\n  border-color: #67e8f9;\n  color: #155e75;',
  '.banco-section-pill--emerald', 'background: #d1fae5;\n  border-color: #6ee7b7;\n  color: #065f46;',
  '.banco-section-pill--sky', 'background: #e0f2fe;\n  border-color: #7dd3fc;\n  color: #075985;',
  '.banco-section-pill--violet',
]) {
  assert.ok(screensCss.includes(declaration), `falta la regla visual de contraste: ${declaration}`);
}
assert.match(screensCss, /\.evaluaciones-header-kpis \.banco-mini-kpi--temas[\s\S]{0,180}color:\s*#075985\s*!important/);
assert.match(screensCss, /\.evaluaciones-header-kpis \.banco-mini-kpi--temaactual[\s\S]{0,180}color:\s*#065f46\s*!important/);
assert.match(screensCss, /\.temarios-panel \.temarios-panel__title[\s\S]{0,220}color:\s*var\(--ui-ink, var\(--texto\)\)\s*!important[\s\S]{0,120}-webkit-text-fill-color:\s*var\(--ui-ink, var\(--texto\)\)\s*!important/);
assert.match(screensCss, /\.asistencia-materia-pick-arrow\s*\{[^}]*color:\s*var\(--ui-accent-primary\)/s);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.temarios-panel__icon-orb\s*\{[^}]*color:\s*var\(--ui-accent-warning\)/s);
assert.match(screensCss, /WCAG AA: --ui-accent-danger[\s\S]{0,180}:root:not\(\[data-theme="dark"\]\) \.plantillas-panel__icon-orb\s*\{[^}]*color:\s*var\(--ui-accent-danger\)/s);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.temario-avatar\s*\{[^}]*background:\s*rgba\(245,\s*158,\s*11,\s*0\.12\)[^}]*color:\s*#b45309/);
assert.match(screensCss, /\.temarios-upload-box\s*\{[^}]*border:\s*2px dashed var\(--ui-accent-warning\)[^}]*background:\s*var\(--ui-canvas\)/);
assert.match(screensCss, /\.temarios-upload-box:hover,\s*\.temarios-upload-box\.drag-active\s*\{[^}]*border-color:\s*var\(--ui-accent-warning\)/);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.temarios-card:hover\s*\{[^}]*border-color:\s*#d97706/);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.temarios-node-item:hover\s*\{[^}]*border-color:\s*#d97706/);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.temarios-node-num\s*\{[^}]*background:\s*rgba\(245,\s*158,\s*11,\s*0\.12\)[^}]*color:\s*#b45309/);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.auth-portal__title\s*\{[^}]*color:\s*var\(--texto\)/);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.auth-portal__subtitle\s*\{[^}]*color:\s*var\(--textoSuave\)/);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.auth-showcase-desc\s*\{[^}]*color:\s*var\(--textoSuave\)/);
assert.match(screensCss, /:root:not\(\[data-theme="dark"\]\) \.auth-showcase-badge\s*\{[^}]*background:\s*var\(--superficieSolida\)[^}]*border-color:\s*var\(--chipTexto\)[^}]*color:\s*var\(--chipTexto\)/);
assert.match(screensCss, /\.auth-pwd-meter-label\s*\{[^}]*color:\s*var\(--textoSuave\)[^}]*font-size:\s*0\.875rem/);
for (const [level, token] of [['1', '--peligroTexto'], ['2', '--avisoTexto'], ['3', '--acentoAzul'], ['4', '--exitoTexto']]) {
  assert.match(screensCss, new RegExp(`:root \\.auth-pwd-meter\\[data-nivel="${level}"\\] \\.auth-pwd-bar--active\\s*\\{[^}]*background-color:\\s*var\\(${token}\\)`));
}
assert.match(css, /WCAG AA: los indicadores de Materias[\s\S]{0,450}#eef4fa/);
assert.match(css, /\.materias-panel \.materia-mini-kpi--active \.materia-mini-kpi__num[\s\S]{0,150}color:\s*#075985\s*!important/);
assert.match(css, /\.materias-panel \.materia-mini-kpi--groups \.materia-mini-kpi__num[\s\S]{0,150}color:\s*#065f46\s*!important/);
assert.match(css, /\.materias-panel \.materia-mini-kpi--closing \.materia-mini-kpi__num[\s\S]{0,150}color:\s*#92400e\s*!important/);
assert.match(css, /WCAG AA: #334155 sobre #f1f5f9[\s\S]{0,300}background:\s*#f1f5f9[\s\S]{0,100}color:\s*#334155\s*!important/);
assert.match(css, /WCAG AA: tarjeta opaca[\s\S]{0,300}background:\s*#f8fafc\s*!important/);
assert.match(css, /\.materias-panel \.materia-card-meta \.materia-meta-lbl[\s\S]{0,250}color:\s*#475569\s*!important/);
assert.match(css, /\.materias-panel \.materia-card-meta \.materia-meta-value[\s\S]{0,180}color:\s*#0f172a\s*!important/);
assert.match(css, /\.materias-panel \.materia-card-alumnos__header strong[\s\S]{0,180}color:\s*#075985\s*!important/);
assert.match(css, /\.materia-title-group \.chip\s*\{[^}]*color:\s*var\(--texto\)\s*!important[^}]*background:\s*var\(--exitoBg\)\s*!important/);
assert.match(css, /\.materia-title-group \.chip--por_iniciar\s*\{[^}]*color:\s*var\(--texto\)\s*!important[^}]*background:\s*var\(--chipBg\)\s*!important/);
assert.match(css, /\.materia-title-group \.chip--por_finalizar\s*\{[^}]*color:\s*var\(--texto\)\s*!important[^}]*background:\s*var\(--avisoBg\)\s*!important/);
assert.match(css, /\.materia-title-group \.chip--concluido\s*\{[^}]*color:\s*var\(--texto\)\s*!important[^}]*background:\s*var\(--exitoBg\)\s*!important/);
assert.match(css, /:root\[data-theme="dark"\] \.page--docente \.materias-panel \.materia-title-group \.chip\s*\{[^}]*color:\s*var\(--exitoTexto\)\s*!important[^}]*background:\s*var\(--exitoBg\)\s*!important/);
assert.match(css, /:root\[data-theme="dark"\] \.page--docente \.materias-panel \.materia-title-group \.chip--por_iniciar\s*\{[^}]*color:\s*var\(--chipTexto\)\s*!important[^}]*background:\s*var\(--chipBg\)\s*!important/);
assert.match(css, /:root\[data-theme="dark"\] \.page--docente \.materias-panel \.materia-title-group \.chip--por_finalizar\s*\{[^}]*color:\s*var\(--avisoTexto\)\s*!important[^}]*background:\s*var\(--avisoBg\)\s*!important/);

const results = checks.map((check) => ({
  ...check,
  ratio: contrastRatio(check.foreground, check.background),
}));

for (const result of results) {
  assert.ok(
    result.ratio >= result.minimum,
    `${result.id}: ${result.ratio.toFixed(2)}:1 < ${result.minimum}:1`,
  );
  console.log(`${result.id}: ${result.ratio.toFixed(2)}:1 PASS`);
}

console.log(`WCAG 2.x contraste: ${results.length}/${results.length} pares PASS`);
