# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: omr-max-density-qr-type-fix-20260927-r1
- parentSessionId: -
- status: final
- generatedAt: 2026-09-27T05:52:03.470Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: coding assistant
- channel: Codex desktop

## Solicitud
- Continuar aumentando la capacidad segura de plantilla y proteger detección OMR/QR en la siguiente versión.

## Objetivo
- Preservar el máximo demostrado de reactivos cortos por hoja dúplex mientras la geometría OMR y los QR exactos siguen legibles bajo rasterización degradada; mantener abierta la mejora general del detector fotográfico.

## Alcance
- Regresión de capacidad máxima con verificación de QR en ambas páginas
- Corrección de error TypeScript en el preprocesamiento QR
- Pruebas PDF/OMR focalizadas, lint y tipado

## Restricciones
- No alterar la clave ni las etiquetas existentes
- No relajar umbrales sin evidencia independiente
- No inferir validación física de una simulación geométrica
- Preservar cambios concurrentes del checkout

## Acciones
- [ok] mejora: La prueba del fixture de 31 reactivos ahora rasteriza las dos páginas, aplica blur 0.3 y JPEG calidad 72 4:2:0 y exige que ambos QR coincidan byte a byte con el mapa. (2026-09-27T05:52:03.256Z)
- [ok] correccion: El filtro de enfoque QR pasa a la API tipada de Sharp con sigma explícito 1; se conserva la intensidad nominal. (2026-09-27T05:52:03.256Z)
- [ok] validacion: 105 pruebas PDF/QR/OMR aprobadas, ESLint focal y TypeScript directo sin emitir artefactos; SDD audit exitoso. (2026-09-27T05:52:03.256Z)

## Archivos leidos
- AGENTS.md
- docs/POLITICA_SDD.md
- docs/IA_TRAZABILIDAD_AGENTES.md
- docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
- apps/backend/src/modulos/modulo_generacion_pdf/domain/duplexOmrGuard.ts
- apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
- apps/backend/scripts/omr-eval-real-dataset.mjs
- apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/consensoRespuesta.ts
- apps/backend/tests/omr.consenso.robusto.test.ts
- apps/backend/tests/pdf.layout.visual.guard.test.ts
- apps/backend/tests/pdf.canonico.test.ts

## Archivos cambiados
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/tests/pdf.layout.visual.guard.test.ts
- docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md

## Validacion ejecutada
- max_density_qr_regression: `npm test -- tests/pdf.layout.visual.guard.test.ts -t "máximo de reactivos de una línea"` -> ok (exitCode=0, duracionMs=9360)
  resultado: 31 reactivos en 2 páginas; colisiones 0; QR exactos 2/2 después de raster, blur 0.3 y JPEG 72 4:2:0.
- pdf_and_omr_focused_suites: `npm test -- tests/pdf.layout.visual.guard.test.ts tests/pdf.canonico.test.ts tests/omr.qr.preimpresion.test.ts tests/omr.consenso.robusto.test.ts tests/omr.estado-respuesta.test.ts` -> ok (exitCode=0, duracionMs=38620)
  resultado: 5 archivos; 105/105 pruebas aprobadas.
- eslint_changed_typescript: `npx eslint src/modulos/modulo_escaneo_omr/servicioOmrCv.ts tests/pdf.layout.visual.guard.test.ts --max-warnings=0` -> ok (exitCode=0, duracionMs=10000)
  resultado: ESLint focal sin advertencias.
- typecheck_no_prisma_generation: `npx tsc --noEmit --project tsconfig.json --pretty false` -> ok (exitCode=0, duracionMs=10900)
  resultado: TypeScript sin errores; incluye la corrección de firma Sharp.
- typecheck_package_script: `npm run typecheck` -> falla (exitCode=1, duracionMs=3200)
  resultado: El script ejecuta prisma generate; Windows devolvió EPERM al borrar node_modules/.prisma/client/index.js. La compilación tsc directa posterior sí pasó.
- sdd_audit: `npm run sdd:audit` -> ok (exitCode=0, duracionMs=1100)
  resultado: Auditoría exitosa; todas las especificaciones cumplen.
- capacity_probe_32_33: `npx tsx -e <generar 32 y 33 reactivos brevísimos>` -> falla (exitCode=1, duracionMs=2600)
  resultado: El runtime no inició por uv_os_get_passwd ENOMEM; no se generaron PDFs ni se midió capacidad adicional.

## Decisiones
- No se cambia densidad ni geometría OMR: se protege con prueba el caso máximo ya demostrado de 31 reactivos breves.
- La prueba verifica QR de ambas caras bajo degradación controlada, pero no representa una captura fotográfica real.
- El error de Prisma se evita sin modificar ni regenerar el cliente; TypeScript se comprobó por separado.

## Supuestos
- El reporte de evaluación local corresponde al dataset fotográfico de Mobile Devices más la imagen adjunta y usa el mapeo persistido del benchmark.

## Riesgos abiertos
- La lectura QR en fotografías históricas sigue limitada según la última corrida integral; el test de rasterización sintética no prueba esa brecha.
- No se pudo explorar 32/33 reactivos por falta de memoria del runtime al iniciar el probe.
- No hay cambios de layout para contenido largo porque este test solo representa reactivos breves.

## Estado del arbol
```txt
M .github/workflows/autogen-docs.yml
 M .github/workflows/ci-backend.yml
 M .github/workflows/ci-docs.yml
 M .github/workflows/ci-frontend.yml
 M .github/workflows/ci-installer-windows.yml
 M .github/workflows/ci-policy-audit.yml
 M .github/workflows/ci-portal.yml
 M .github/workflows/ci.yml
 M .github/workflows/pages-marketing.yml
 M .github/workflows/release-beta.yml
 M .github/workflows/release-stable-gate.yml
 M .github/workflows/security-codeql.yml
 M AGENTS.md
 M CHANGELOG.md
 M apps/backend/package-lock.json
 M apps/backend/package.json
 M apps/backend/prisma/schema.prisma
 M apps/backend/reports/qa/latest/global-grade.json
 M apps/backend/scripts/omr-sweep-geometria.ts
 M apps/backend/src/compartido/robustez/soporteRetry.ts
 M apps/backend/src/infraestructura/baseDatos/sqlite.ts
 M apps/backend/src/infraestructura/seguridad/rbac.ts
 M apps/backend/src/modulos/modulo_analiticas/controladorAnaliticas.ts
 M apps/backend/src/modulos/modulo_analiticas/rutasAnaliticas.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioExportacionDocx.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioExportacionXlsxCalificaciones.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioListaAcademica.ts
 M apps/backend/src/modulos/modulo_analiticas/tiposListaAcademica.ts
 M apps/backend/src/modulos/modulo_analiticas/validacionesAnaliticas.ts
 M apps/backend/src/modulos/modulo_asistencias/controladorAsistencias.ts
 M apps/backend/src/modulos/modulo_autenticacion/middlewareAutenticacion.ts
 M apps/backend/src/modulos/modulo_banco_preguntas/controladorBancoPreguntas.ts
 M apps/backend/src/modulos/modulo_banco_preguntas/rutasBancoPreguntas.ts
 M apps/backend/src/modulos/modulo_banco_preguntas/validacionesBancoPreguntas.ts
 M apps/backend/src/modulos/modulo_calificacion/controladorCalificacion.ts
 M apps/backend/src/modulos/modulo_calificacion/validacionesCalificacion.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/README.md
 M apps/backend/src/modulos/modulo_escaneo_omr/controladorJobsOmr.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCv.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/omrCore.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/porFolioDataset.ts
 M apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generacionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/controladorListadoGenerados.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/examenPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/layoutExamen.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/qrExamen.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/recoveryManifest.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/infra/configuracionLayoutEnv.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/tiposPdf.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/controladorHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/rutasHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/servicioHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/validacionesHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_integraciones_classroom/controladorIntegracionesClassroom.ts
 M apps/backend/src/modulos/modulo_integraciones_classroom/servicioSyncClassroom.ts
 M apps/backend/src/modulos/modulo_integraciones_classroom/validacionesClassroom.ts
 M apps/backend/src/modulos/modulo_listas_institucionales/servicioListasInstitucionales.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/domain/instantaneaLocal.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/domain/paqueteSincronizacion.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/infra/omrCapturas.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/sincronizacionInterna.ts
 M apps/backend/tests/analiticas.xlsx.sv.contract.test.ts
 M apps/backend/tests/bancoPreguntas.controlador.test.ts
 M apps/backend/tests/calificacion.omr.payload.test.ts
 M apps/backend/tests/integracion/_flujoDocenteHelper.ts
 M apps/backend/tests/integracion/archivarExamenGenerado.test.ts
 M apps/backend/tests/integracion/asistencia.reglas.test.ts
 M apps/backend/tests/integracion/classroom.v2.test.ts
 M apps/backend/tests/integracion/examenesRetention.test.ts
 M apps/backend/tests/integracion/flujoExamen.test.ts
 M apps/backend/tests/integracion/hidratacionCursos.test.ts
 M apps/backend/tests/integracion/listaAcademicaContratos.test.ts
 M apps/backend/tests/integracion/listasInstitucionales.test.ts
 M apps/backend/tests/integracion/omrJobsWorkflow.test.ts
 M apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
 M apps/backend/tests/integracion/qrEscaneoOmr.test.ts
 M apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts
 M apps/backend/tests/integracion/rolesPermisos.test.ts
 M apps/backend/tests/omr.core.decision.test.ts
 M apps/backend/tests/omr.geometry.reference.test.ts
 M apps/backend/tests/omr.test.ts
 M apps/backend/tests/pdf.canonico.test.ts
 M apps/backend/tests/pdf.layout.visual.guard.test.ts
 M apps/backend/tests/pdf.numeroPaginasPlantilla.test.ts
 M apps/backend/tests/pdf.paridad.test.ts
 M apps/backend/tests/qr.examen.test.ts
 M apps/backend/tests/recovery.manifest.test.ts
 M apps/backend/tests/setup.ts
 M apps/backend/tests/sincronizacion.test.ts
 M apps/backend/tests/utils/mongo.ts
 M apps/frontend/package-lock.json
 M apps/frontend/package.json
 M apps/frontend/src/apps/app_docente/AppDocente.tsx
 M apps/frontend/src/apps/app_docente/SeccionAsistencias.tsx
 M apps/frontend/src/apps/app_docente/SeccionBanco.tsx
 M apps/frontend/src/apps/app_docente/SeccionCalificaciones.tsx
 M apps/frontend/src/apps/app_docente/SeccionCalificar.tsx
 M apps/frontend/src/apps/app_docente/SeccionClassroom.tsx
 M apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx
 M apps/frontend/src/apps/app_docente/SeccionPeriodos.tsx
 M apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx
 M apps/frontend/src/apps/app_docente/SeccionRegistroEntrega.tsx
 M apps/frontend/src/apps/app_docente/features/banco/components/BancoFormularioPregunta.tsx
 M apps/frontend/src/apps/app_docente/features/banco/components/BancoListadoPreguntas.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasGenerados.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasGeneradosActions.ts
 M apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions.ts
 M apps/frontend/src/apps/app_docente/hooks/usePermisosDocente.ts
 M apps/frontend/src/apps/app_docente/hooks/useRecordatorioPaseLista.ts
 M apps/frontend/src/apps/app_docente/tipos.ts
 M apps/frontend/src/apps/app_docente/utilidades.ts
 M apps/frontend/src/styles.css
 M apps/frontend/src/styles/cards.css
 M apps/frontend/src/styles/screens.css
 M apps/frontend/src/tipos/tesseract-js.d.ts
 M apps/frontend/src/ui/iconos.tsx
 M apps/frontend/src/ui/version/VersionInfoPage.tsx
 M apps/frontend/tests/appDocente.previewConsolidado.test.tsx
 M apps/frontend/tests/banco.refactor.test.tsx
 M apps/frontend/tests/escaneo.refactor.test.tsx
 M apps/frontend/tests/gui.responsive.contract.test.tsx
 M apps/frontend/tests/plantillas.hooks.test.tsx
 M apps/frontend/tests/plantillas.refactor.test.tsx
 M apps/frontend/tests/seccionAsistencias.test.tsx
 M apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx
 M apps/frontend/tests/seccionCalificar.test.tsx
 M apps/frontend/tests/seccionClassroom.test.tsx
 M apps/frontend/tests/seccionPaqueteSincronizacion.test.tsx
 M apps/frontend/tests/utilidades.appDocente.test.ts
 M apps/frontend/tests/versionInfo.helpers.test.tsx
 M apps/frontend/tests/versionInfoPage.test.tsx
 M apps/frontend/vite.config.ts
 M apps/portal_alumno_cloud/package-lock.json
 M apps/portal_alumno_cloud/package.json
 M apps/portal_alumno_cloud/prisma/schema.prisma
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/browser.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/client.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/commonInputTypes.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/enums.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/class.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/prismaNamespace.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/prismaNamespaceBrowser.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/AgendaAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/AvisoAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/CodigoAcceso.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/EventoUsoAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/HistorialAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/MateriaAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/PaqueteSyncDocente.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/PerfilAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/ResultadoAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/SesionAlumno.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/SolicitudRevision.ts
 M apps/portal_alumno_cloud/src/infraestructura/baseDatos/sqlite.ts
 M apps/portal_alumno_cloud/tests/utils/mongo.ts
 M config/version-catalog.json
 M docs/AUTO_ENV.md
 M docs/IA_SKILLS_MCP_POLICY.md
 M docs/INVENTARIO_CODIGO_EXHAUSTIVO.md
 M docs/VERSIONADO.md
 M docs/WCAG_UI_POLICY.md
 M docs/specs/SPEC-036_autenticacion_guardrails.spec.md
 M docs/specs/SPEC-039_asistencias_seguimiento.spec.md
 M docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md
 M docs/specs/SPEC-046_google_classroom_sync.spec.md
 M docs/specs/SPEC-053_guardrails_google_oauth_runtime.spec.md
 M docs/specs/SPEC-054_identidad_visual_frontend_completa.spec.md
 M docs/specs/e2e_playwright_screen_functional_matrix.spec.md
 M docs/specs/flujo_docente_alumno_integral.spec.md
 M docs/specs/listas_institucionales_por_plantilla.spec.md
 M docs/specs/release_stable_installer_firma.spec.md
 M package-lock.json
 M package.json
 M packaging/app-host/App.xaml.cs
 M packaging/app-host/MainWindow.xaml.cs
 M packaging/wix/BurnBootstrapperApp/EvaluaPro.BurnBootstrapperApp.csproj
 M packaging/wix/README.md
 M reports/qa/latest/clean-architecture.json
 M reports/qa/latest/dataset-prodlike.json
 M reports/qa/latest/e2e-docente-alumno.json
 M reports/qa/latest/evaluaciones-e2e.json
 M reports/qa/latest/evaluaciones-policy.json
 M reports/qa/latest/global-grade.json
 M reports/qa/latest/manifest.json
 M reports/qa/latest/pdf-print.json
 M reports/qa/latest/ux-visual.json
 M scripts/build-msi.ps1
 D scripts/build-native-dist.ps1
 M scripts/perf-collect-business.ts
 M scripts/release/validate-stable-promotion.mjs
 M scripts/runtime-env.mjs
 M scripts/sdd-audit.mjs
 M scripts/serve-docente-static.mjs
 M scripts/start-docente-native.mjs
 M scripts/testing/generar-qa-manifest.mjs
 M scripts/testing/run-backend-test-batches.mjs
 M scripts/testing/start-frontend-e2e-server.mjs
 M scripts/testing/windows-release-smoke-ownership.mjs
 M scripts/tests/app-host-health.contract.test.mjs
 M scripts/tests/app-host-shutdown.contract.test.mjs
 M scripts/tests/backend-test-batches.test.mjs
 M scripts/tests/ci-workflow-contract.test.mjs
 M scripts/tests/installer-hub-contract.test.mjs
 M scripts/tests/native-startup.contract.test.mjs
 M scripts/tests/omr-version-policy.test.mjs
 M scripts/tests/release-stable-promotion.test.mjs
 M scripts/tests/runtime-env.test.mjs
 M scripts/tests/sdd-audit.test.mjs
 M scripts/tests/seed-docente-dummy.mjs
 M scripts/tests/windows-release-smoke-ownership.test.mjs
 M scripts/tests/windows-release-smoke.test.mjs
 M scripts/tests/wix-version-policy.test.mjs
 M tests/gui-responsive/ciclo-completo.spec.ts
 M tests/gui-responsive/journey-docente-integral.spec.ts
 M tests/gui-responsive/playwright.ciclo.config.mjs
?? .agents/skills/evaluapro-exam-batch-qa/
?? .agents/skills/evaluapro-exam-workflow/
?? .agents/skills/evaluapro-reactivo-review/
?? .agents/skills/evaluapro-topic-blueprint/
?? apps/backend/prisma.config.mjs
?? apps/backend/scripts/omr-eval-real-dataset.mjs
?? apps/backend/scripts/omr-qr-preprint-check.ts
?? apps/backend/src/modulos/modulo_analiticas/servicioListaFisicaParcial2.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/controladorReactivos.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/reactivosContrato.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/reactivosXlsx.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/servicioCalibracionReactivos.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/servicioReactivos.ts
?? apps/backend/src/modulos/modulo_escaneo_omr/infra/metricasDatasetOmr.ts
?? apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/
?? apps/backend/src/modulos/modulo_generacion_pdf/domain/duplexOmrGuard.ts
?? apps/backend/src/modulos/modulo_generacion_pdf/domain/validacionLotePdf.ts
?? apps/backend/src/modulos/modulo_integraciones_classroom/calculoAcumuladoTareas.ts
?? apps/backend/tests/calculoAcumuladoTareas.test.ts
?? apps/backend/tests/calificacion.omr.estado.test.ts
?? apps/backend/tests/integracion/reactivosIngesta.test.ts
?? apps/backend/tests/listaAcademicaResumen.test.ts
?? apps/backend/tests/listaFisicaParcial2.persistencia.test.ts
?? apps/backend/tests/listaFisicaParcial2.test.ts
?? apps/backend/tests/listaFisicaParcial2.validaciones.test.ts
?? apps/backend/tests/omr.consenso.robusto.test.ts
?? apps/backend/tests/omr.dataset-grain.test.ts
?? apps/backend/tests/omr.estado-respuesta.test.ts
?? apps/backend/tests/omr.qr.preimpresion.test.ts
?? apps/backend/tests/pdf.ink-sparing-staple.test.ts
?? apps/backend/tests/pdf.lote.integridad.test.ts
?? apps/backend/tests/reactivosCalibracion.test.ts
?? apps/backend/tests/reactivosContrato.test.ts
?? apps/frontend/src/apps/app_docente/ConsultaCalificaciones.tsx
?? apps/frontend/src/apps/app_docente/SolicitudesRevisionPanel.tsx
?? apps/frontend/src/apps/app_docente/features/banco/components/BancoImportacionReactivos.tsx
?? apps/frontend/src/apps/app_docente/features/plantillas/loteGeneracionSesion.ts
?? apps/frontend/src/apps/app_docente/fechaLocal.ts
?? apps/frontend/src/apps/app_docente/ocrTexto.ts
?? apps/frontend/src/ui/IconoLucide.tsx
?? apps/frontend/src/ui/iconosCatalogo.ts
?? apps/frontend/src/ui/version/changelog.ts
?? apps/frontend/src/ui/version/legal/
?? apps/frontend/tests/bancoImportacionReactivos.test.tsx
?? apps/frontend/tests/changelog.test.ts
?? apps/frontend/tests/fechaLocal.test.ts
?? apps/frontend/tests/ocrTexto.test.ts
?? apps/frontend/tests/permisosBanco.hooks.test.tsx
?? apps/frontend/tests/plantillas.loteSesion.test.ts
?? apps/frontend/tests/seccionCalificaciones.resumen.test.tsx
?? apps/portal_alumno_cloud/prisma.config.mjs
?? docs/GUIA_ICONOGRAFIA.md
?? docs/contracts/
?? docs/handoff/sesiones/2026-09-23/
?? docs/handoff/sesiones/2026-09-24/
?? docs/handoff/sesiones/2026-09-25/
?? docs/handoff/sesiones/2026-09-27/
?? docs/qa/
?? docs/specs/SPEC-059_consulta_calificaciones_por_alumno.spec.md
?? docs/specs/SPEC-060_omr_consenso_captura_real.spec.md
?? docs/specs/SPEC-061_banco_reactivos_ia_versionado.spec.md
?? docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
?? docs/specs/SPEC-063_omr_orientacion_y_inclinacion_pagina.spec.md
?? docs/specs/SPEC-064_actualizacion_dependencias_toolchains.spec.md
?? docs/specs/SPEC-065_ciclo_vida_servicios_app_host.spec.md
?? docs/specs/SPEC-066_sqlite_test_isolation.spec.md
?? docs/specs/SPEC-068_generacion_lotes_pdf_integridad.spec.md
?? global.json
?? output/qa/EvaluaPro-omr-camera-dataset-camscanner-20260924.zip
?? output/qa/EvaluaPro-omr-camera-dataset-camscanner-20260924.zip.sha256
?? output/qa/omr-camera-camscanner-20260924/
?? output/qa/omr-plantilla-sync-20260923.layout.json
?? output/qa/omr-plantilla-sync-20260923.pdf
?? output/qa/qa_omr_plantilla_20260925/
?? scripts/migrate-calificaciones-lista-manual-sqlite.mjs
?? scripts/migrate-examen-lote-artefactos-pdf-sqlite.mjs
?? scripts/migrate-reactivos-backfill.mjs
?? scripts/migrate-reactivos-sqlite.mjs
?? scripts/tests/dependency-toolchain-policy.test.mjs
?? scripts/tests/migrate-calificaciones-lista-manual-sqlite.test.mjs
?? scripts/tests/migrate-examen-lote-artefactos-pdf-sqlite.test.mjs
?? scripts/tests/migrate-reactivos-backfill.test.mjs
?? scripts/tests/migrate-reactivos-sqlite.test.mjs
?? storage/omr_debug/058868F3/
?? storage/omr_debug/1458887E/
?? storage/omr_debug/5AFC1D79/
?? storage/omr_debug/780DC77D/
?? storage/omr_debug/DCA5097F/
?? storage/omr_debug/E2FAFF07/
?? storage/omr_debug/EE26CF1C/
?? tests/gui-responsive/banco-reactivos.spec.ts
?? tests/gui-responsive/plantillas-pdf-edge.spec.ts
?? tests/gui-responsive/playwright.pdf-edge.config.mjs
```

## Siguiente paso recomendado
- Tras liberar recursos del host, medir capacidad con contenido real etiquetado y revisar espacio físico de cabecera; para un cambio de plantilla QR, validar primero con capturas impresas reales y benchmark integral.

## Artefactos generados
- Sin artefactos generados.

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
