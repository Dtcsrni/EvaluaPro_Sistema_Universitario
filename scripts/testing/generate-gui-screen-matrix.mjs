/**
 * generate-gui-screen-matrix
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const write = process.argv.includes('--write');
const today = '2026-05-27';
const jsonPath = path.join(root, 'reports', 'qa', 'latest', 'gui-screen-matrix.json');
const markdownPath = path.join(root, 'docs', 'release', 'manual', `gui-screen-matrix-${today}.md`);

const sources = {
  design: 'docs/DESIGN.md',
  installer: 'docs/INSTALLER_HUB.md',
  docentePermisos: 'apps/frontend/src/apps/app_docente/hooks/usePermisosDocente.ts',
  docenteApp: 'apps/frontend/src/apps/app_docente/AppDocente.tsx',
  alumnoApp: 'apps/frontend/src/apps/app_alumno/AppAlumno.tsx',
  adminApp: 'apps/frontend/src/apps/app_admin_negocio/AppAdminNegocio.tsx',
  dashboard: 'scripts/launcher-dashboard.mjs',
  hubXaml: 'packaging/wix/BurnBootstrapperApp/MainWindow.xaml'
};

function readSource(key) {
  const relativePath = sources[key];
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Fuente requerida no existe: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function assertContains(sourceKey, pattern, reason) {
  const content = readSource(sourceKey);
  if (!pattern.test(content)) {
    throw new Error(`Contrato no encontrado en ${sources[sourceKey]}: ${reason}`);
  }
}

const defaultStates = ['loading', 'empty', 'error', 'warning', 'success'];
const defaultViewports = ['desktop', 'tablet', 'mobile'];

const primaryActions = new Map([
  ['docente:login', 'Iniciar sesion docente'],
  ['docente:periodos', 'Crear o editar materia/periodo'],
  ['docente:alumnos', 'Registrar o actualizar alumno'],
  ['docente:banco', 'Crear o ajustar pregunta'],
  ['docente:plantillas', 'Generar o previsualizar plantilla'],
  ['docente:entrega', 'Registrar entrega o recuperar lote'],
  ['docente:calificaciones', 'Revisar y publicar calificacion'],
  ['docente:rehidratacion', 'Importar lote para rehidratacion'],
  ['docente:evaluaciones', 'Configurar o revisar evaluacion'],
  ['docente:sincronizacion', 'Publicar o sincronizar datos'],
  ['docente:cuenta', 'Gestionar sesion docente'],
  ['alumno:login', 'Consultar resultados'],
  ['alumno:resultados', 'Revisar detalle o solicitar revision'],
  ['admin-negocio:dashboard', 'Recargar tablero de negocio'],
  ['admin-negocio:tenants', 'Revisar tenant o soporte'],
  ['dashboard-local:estado', 'Verificar runtime local'],
  ['dashboard-local:version', 'Revisar version o update'],
  ['installer-hub:bienvenida', 'Seleccionar modo y continuar'],
  ['installer-hub:revisar', 'Revisar equipo o remediar requisito'],
  ['installer-hub:resultado', 'Cerrar, reintentar o abrir evidencia']
]);

const componentPurpose = new Map([
  ['hero operativo', 'orienta al usuario sin competir con el formulario'],
  ['formulario login', 'captura credenciales con validacion directa y recuperacion clara'],
  ['ayuda contextual', 'explica el siguiente paso sin texto decorativo'],
  ['version/update', 'expone estado tecnico solo cuando aporta soporte'],
  ['tabs docente', 'reduce profundidad de navegacion y mantiene contexto'],
  ['tabla/listado', 'permite escanear, comparar y actuar sobre registros'],
  ['formulario', 'agrupa captura primaria con etiquetas visibles'],
  ['acciones CRUD', 'mantiene accion primaria destacada y secundarias contenidas'],
  ['estado permisos', 'evita controles disponibles sin autorizacion real'],
  ['listado alumnos', 'facilita busqueda y mantenimiento academico'],
  ['mensajes inline', 'da feedback junto al control afectado'],
  ['filtros', 'reduce ruido antes de operar en listas largas'],
  ['listado preguntas', 'prioriza contenido academico y acciones frecuentes'],
  ['formulario pregunta', 'ordena enunciado, opciones y metadatos sin saturar'],
  ['gestion temas', 'mantiene clasificacion cercana al banco'],
  ['listado plantillas', 'separa plantillas reutilizables de acciones de generacion'],
  ['preview PDF', 'permite verificar salida antes de imprimir o entregar'],
  ['workflow OMR', 'guia lectura, revision y confirmacion con estados visibles'],
  ['registro entrega', 'documenta trazabilidad de entrega sin pasos ocultos'],
  ['paquete interno', 'expone sincronizacion local como accion controlada'],
  ['estado lote', 'hace visible progreso y errores recuperables'],
  ['acciones de recuperacion', 'ofrece salida segura ante fallos operativos'],
  ['selector manual', 'elige el examen antes de editar calificacion'],
  ['tabla resultados', 'prioriza comparacion, detalle y publicacion'],
  ['revision OMR', 'separa decision automatica de confirmacion humana'],
  ['publicacion', 'cierra el flujo con accion explicita y reversible cuando aplique'],
  ['selector archivo', 'limita importacion a un punto claro de entrada'],
  ['estado importacion', 'muestra avance, resultado y pasos siguientes'],
  ['errores recuperables', 'convierte fallos en acciones concretas'],
  ['resumen', 'presenta estado antes del detalle'],
  ['listado evaluaciones', 'ordena evidencias y resultados por prioridad'],
  ['acciones', 'mantiene comandos predecibles cerca del contenido'],
  ['estado sincronizacion', 'evita publicar o importar a ciegas'],
  ['estado portal', 'expone disponibilidad antes de publicar'],
  ['acciones publicar', 'distingue preparacion, envio y confirmacion'],
  ['avisos', 'comunica riesgos sin bloquear la tarea principal'],
  ['recuperacion', 'ofrece continuidad cuando falla el flujo normal'],
  ['perfil', 'muestra identidad y configuracion util'],
  ['sesion', 'permite cerrar o renovar contexto de forma visible'],
  ['permisos', 'explica capacidades actuales sin duplicar administracion'],
  ['salir', 'cierra sesion con una accion clara'],
  ['hero portal', 'ubica al alumno en consulta de resultados'],
  ['codigo acceso', 'captura el dato mas importante con baja friccion'],
  ['matricula', 'desambigua identidad del alumno'],
  ['consultar', 'accion primaria unica del acceso'],
  ['resumen visual', 'explica resultado final antes del desglose'],
  ['detalle resultado', 'permite entender cada evidencia evaluada'],
  ['solicitud revision', 'canaliza inconformidades sin romper el flujo'],
  ['conformidad', 'registra aceptacion de forma explicita'],
  ['PDF', 'conserva salida descargable/consultable'],
  ['nav vistas', 'permite cambiar de tablero sin perder estado'],
  ['metricas', 'muestra salud del negocio con baja carga cognitiva'],
  ['tenants', 'agrupa administracion multi-tenant'],
  ['recargar', 'refresca datos sin reiniciar contexto'],
  ['tabla tenants', 'permite soporte y comparacion operativa'],
  ['salud', 'expone disponibilidad antes de operar'],
  ['licencias', 'conecta estado comercial con soporte'],
  ['soporte', 'contiene acciones sensibles'],
  ['runtime efectivo', 'muestra si el stack real coincide con contrato'],
  ['broker', 'centraliza acciones locales elevadas/controladas'],
  ['shortcuts', 'verifica entradas visibles del usuario'],
  ['soporte privilegiado', 'reserva acciones riesgosas tras step-up'],
  ['version', 'identifica build instalado'],
  ['update status', 'hace visible disponibilidad/progreso de updates'],
  ['acciones soporte', 'reduce comandos manuales inseguros'],
  ['logs', 'facilita diagnostico sin exponer ruido por defecto'],
  ['stepper', 'ubica al usuario en el flujo de instalacion'],
  ['modo instalar/reparar/desinstalar', 'define intencion antes de mutar el sistema'],
  ['boton primario', 'ofrece una decision principal por etapa'],
  ['bitacora', 'mantiene trazabilidad tecnica bajo demanda'],
  ['prerequisitos', 'expone bloqueos antes de instalar'],
  ['estado por requisito', 'muestra listo, pendiente o fallo sin ambiguedad'],
  ['remediacion', 'traduce prerequisitos faltantes en acciones concretas'],
  ['restart', 'hace explicito cuando el sistema requiere reinicio'],
  ['resumen final', 'cierra con resultado y siguiente accion'],
  ['logs BA/MSI', 'da evidencia tecnica para soporte'],
  ['reintentar', 'permite recuperacion sin reiniciar desde cero'],
  ['cerrar', 'salida clara tras exito o fallo documentado']
]);

function purposeFor(component) {
  return componentPurpose.get(component) ?? 'mantiene funcion visible, necesaria y cercana al flujo principal';
}

function screenshotArtifacts(id, surface) {
  const shortId = id.split(':')[1];
  if (surface === 'frontend-docente') {
    return [
      `reports/qa/latest/gui-docente-${shortId}-desktop-lg.png`,
      `reports/qa/latest/gui-docente-${shortId}-mobile.png`
    ];
  }
  if (surface === 'frontend-alumno') {
    return [
      `reports/qa/latest/gui-alumno-${shortId}-desktop-lg.png`,
      `reports/qa/latest/gui-alumno-${shortId}-mobile.png`
    ];
  }
  if (surface === 'frontend-admin') {
    return [
      `reports/qa/latest/gui-admin-${shortId}-desktop-lg.png`,
      `reports/qa/latest/gui-admin-${shortId}-mobile.png`
    ];
  }
  return [];
}

function screen(id, title, surface, sourceKeys, components, command, artifacts, states = defaultStates) {
  return {
    id,
    title,
    surface,
    sourceFiles: sourceKeys.map((key) => sources[key]),
    components,
    componentChecks: components.map((component) => ({
      component,
      purpose: purposeFor(component)
    })),
    uxReview: {
      primaryAction: primaryActions.get(id) ?? components[components.length - 1],
      simplicity: 'Mantener jerarquia clara, densidad operativa y evitar decoracion sin funcion.',
      feedback: 'Mostrar loading/empty/error/warning/success cerca del elemento afectado.',
      accessibility: 'Controles con nombre accesible, foco visible y orden de tabulacion estable.'
    },
    states,
    viewports: defaultViewports,
    evidence: { command, artifacts: [...artifacts, ...screenshotArtifacts(id, surface)] }
  };
}

assertContains('design', /frontend docente|portal alumno|Dashboard local|Installer Hub/i, 'DESIGN.md debe gobernar UX de las superficies principales');
assertContains('installer', /Flujo funcional/i, 'INSTALLER_HUB.md debe conservar flujo funcional');
assertContains('docentePermisos', /id:\s*'plantillas'/, 'nav docente debe exponer Plantillas');
assertContains('docenteApp', /SeccionCalificaciones/, 'App docente debe montar Calificaciones');
assertContains('alumnoApp', /Portal Alumno|Codigo de acceso/i, 'App alumno debe exponer acceso/resultados');
assertContains('adminApp', /Panel de Negocio|admin-negocio/i, 'App admin negocio debe exponer dashboard');
assertContains('dashboard', /dashboard|broker|runtime/i, 'Dashboard local debe estar cubierto por launcher');
assertContains('hubXaml', /RestartNowButton|Revisar|Instalar|Resultado/i, 'Installer Hub debe cubrir botones/resultado');

const responsiveCommand = 'npm run test:gui:responsive:e2e:ci';
const uxCommand = 'npm run test:ux-quality:ci && npm run test:ux-visual:ci';
const installerCommand = 'npm run test:installer-hub:contract && npm run test:installer-hub:ui';

const screens = [
  screen('docente:login', 'Acceso docente', 'frontend-docente', ['docenteApp'], ['hero operativo', 'formulario login', 'ayuda contextual', 'version/update'], responsiveCommand, []),
  screen('docente:periodos', 'Materias y periodos', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['tabs docente', 'tabla/listado', 'formulario', 'acciones CRUD', 'estado permisos'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('docente:alumnos', 'Alumnos', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['tabs docente', 'listado alumnos', 'formulario', 'mensajes inline'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('docente:banco', 'Banco de preguntas', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['filtros', 'listado preguntas', 'formulario pregunta', 'gestion temas'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('docente:plantillas', 'Plantillas y OMR', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['listado plantillas', 'formulario', 'preview PDF', 'workflow OMR'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('docente:entrega', 'Entrega y recepcion', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['registro entrega', 'paquete interno', 'estado lote', 'acciones de recuperacion'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('docente:calificaciones', 'Calificaciones', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['selector manual', 'tabla resultados', 'revision OMR', 'publicacion'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('docente:rehidratacion', 'Rehidratacion de lotes', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['selector archivo', 'estado importacion', 'errores recuperables'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('docente:evaluaciones', 'Evaluaciones', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['resumen', 'listado evaluaciones', 'acciones', 'estado sincronizacion'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('docente:sincronizacion', 'Sincronizacion y publicacion', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['estado portal', 'acciones publicar', 'avisos', 'recuperacion'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('docente:cuenta', 'Cuenta docente', 'frontend-docente', ['docentePermisos', 'docenteApp'], ['perfil', 'sesion', 'permisos', 'salir'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('alumno:login', 'Acceso alumno', 'frontend-alumno', ['alumnoApp'], ['hero portal', 'codigo acceso', 'matricula', 'consultar'], responsiveCommand, ['reports/qa/latest/ux-visual.json']),
  screen('alumno:resultados', 'Resultados alumno', 'frontend-alumno', ['alumnoApp'], ['resumen visual', 'detalle resultado', 'solicitud revision', 'conformidad', 'PDF'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('admin-negocio:dashboard', 'Dashboard negocio', 'frontend-admin', ['adminApp'], ['nav vistas', 'metricas', 'tenants', 'recargar', 'ayuda contextual'], responsiveCommand, ['reports/qa/latest/ux-visual.json']),
  screen('admin-negocio:tenants', 'Tenants y soporte negocio', 'frontend-admin', ['adminApp'], ['tabla tenants', 'salud', 'licencias', 'soporte'], uxCommand, ['reports/qa/latest/ux-visual.json']),
  screen('dashboard-local:estado', 'Dashboard local estado', 'dashboard-local', ['dashboard'], ['runtime efectivo', 'broker', 'shortcuts', 'soporte privilegiado'], 'npm run test:dashboard:repair && npm run test:dashboard:ui', ['reports/qa/latest/manifest.json']),
  screen('dashboard-local:version', 'Dashboard local version y update', 'dashboard-local', ['dashboard'], ['version', 'update status', 'acciones soporte', 'logs'], 'npm run test:update && npm run test:dashboard:repair', ['reports/qa/latest/manifest.json']),
  screen('installer-hub:bienvenida', 'Installer Hub bienvenida', 'installer-hub', ['design', 'installer', 'hubXaml'], ['stepper', 'modo instalar/reparar/desinstalar', 'boton primario', 'bitacora'], installerCommand, ['reports/qa/installer-hub-ui/']),
  screen('installer-hub:revisar', 'Installer Hub revisar equipo', 'installer-hub', ['design', 'installer', 'hubXaml'], ['prerequisitos', 'estado por requisito', 'remediacion', 'restart'], installerCommand, ['reports/qa/installer-hub-ui/']),
  screen('installer-hub:resultado', 'Installer Hub resultado', 'installer-hub', ['design', 'installer', 'hubXaml'], ['resumen final', 'logs BA/MSI', 'reintentar', 'cerrar'], installerCommand, ['reports/qa/installer-hub-ui/'])
];

const matrix = {
  version: 1,
  generatedAt: `${today}T00:00:00-06:00`,
  generatedBy: 'scripts/testing/generate-gui-screen-matrix.mjs',
  designSources: Object.values(sources),
  acceptance: {
    noHorizontalOverflow: true,
    keyboardFocusRequired: true,
    accessibleNamesRequired: true,
    interactiveControlsNoOverlapRequired: true,
    screenshotsRequired: true,
    simplicityAndEleganceRequired: true,
    primaryActionPerScreenRequired: true,
    inlineFeedbackRequired: true,
    vmReleaseLikeRequiredForClosure: true
  },
  screens
};

function markdownFor(matrixValue) {
  const lines = [
    '# Matriz GUI Exhaustiva',
    '',
    `Fecha: ${today}`,
    '',
    'Contrato: cada pantalla debe validar componentes visibles, estados, viewports y evidencia antes de declarar cierre UX/UI.',
    '',
    'Criterio UX: cada pantalla debe sostener una accion primaria clara, jerarquia visual sobria, densidad operativa legible, feedback inline, controles con nombres accesibles y controles interactivos sin solapes materiales. La simplicidad prima sobre decoracion.',
    '',
    '## Fuentes',
    ...matrixValue.designSources.map((source) => `- \`${source}\``),
    '',
    '## Checklist Por Pantalla'
  ];

  for (const item of matrixValue.screens) {
    lines.push(
      '',
      `### ${item.id} - ${item.title}`,
      `- Superficie: \`${item.surface}\``,
      `- Componentes: ${item.components.join(', ')}`,
      ...item.componentChecks.map((check) => `- Sentido: ${check.component} -> ${check.purpose}`),
      `- Accion primaria esperada: ${item.uxReview.primaryAction}`,
      `- Simplicidad: ${item.uxReview.simplicity}`,
      `- Feedback: ${item.uxReview.feedback}`,
      `- Estados: ${item.states.join(', ')}`,
      `- Viewports: ${item.viewports.join(', ')}`,
      `- Evidencia: \`${item.evidence.command}\``,
      ...item.evidence.artifacts.map((artifact) => `- Artefacto: \`${artifact}\``),
      '- [ ] Desktop sin overflow/solape',
      '- [ ] Tablet sin overflow/solape',
      '- [ ] Mobile sin overflow/solape',
      '- [ ] Foco visible y orden de tabulacion correcto',
      '- [ ] Nombre accesible en controles interactivos',
      '- [ ] Controles interactivos visibles sin solapes materiales',
      '- [ ] Estado loading/empty/error/warning/success revisado cuando aplica',
      '- [ ] Accion primaria evidente y acciones secundarias sin ruido',
      '- [ ] Jerarquia visual simple, elegante y funcional'
    );
  }

  lines.push(
    '',
    '## Cierre',
    '- No declarar estabilizacion completa si VM real sigue parcial o si falta evidencia de install/repair/update/uninstall.',
    '- Esta matriz, `docs/DESIGN.md`, `docs/UX_QUALITY_CRITERIA.md` y los screenshots Playwright son la fuente de aceptacion visual.'
  );

  return `${lines.join('\n')}\n`;
}

if (write) {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, markdownFor(matrix), 'utf8');
}

console.log(JSON.stringify({
  ok: true,
  screens: screens.length,
  jsonPath: path.relative(root, jsonPath),
  markdownPath: path.relative(root, markdownPath)
}, null, 2));
