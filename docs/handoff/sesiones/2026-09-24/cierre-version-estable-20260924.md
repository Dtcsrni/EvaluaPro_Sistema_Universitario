# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: cierre-version-estable-20260924
- parentSessionId: -
- status: final
- generatedAt: 2026-09-24T10:56:11.863Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: agent
- channel: Codex desktop

## Solicitud
- Sincronizar los hilos de OMR, listas/calificaciones y sincronización para cerrar una versión estable del flujo docente.

## Objetivo
- Integrar y comprobar las mejoras actuales en el checkout canónico, clasificar lo experimental y conservar un No-Go hasta demostrar todos los gates de release.

## Alcance
- Corregir las métricas del dataset OMR para contar capturas, contenidos, páginas y reactivos en granos separados.
- Señalar en la UI los rescates OMR experimentales y los QR no verificados.
- Revalidar de forma focalizada OMR, listas/calificaciones y App Host/sincronización local.
- Inspeccionar gates, versionado, QA vigente y actividad de hilos paralelos.

## Restricciones
- Usar C:/Users/evega/Documents/EvaluaPro como checkout canónico; preservar los cambios concurrentes.
- No escribir calificaciones ni usar bases reales, cursos reales o credenciales de Google.
- No ejecutar gates globales ni benchmark largo sin autorización explícita y sin que termine el hilo activo.
- No afirmar exactitud poblacional a partir de etiquetas visuales no auditadas independientemente.

## Acciones
- [ok] validation: Revalidación focal actual: 9/9 pruebas UI OMR pasan; cobertura de SeccionEscaneo.tsx: 60% sentencias, 61.78% líneas, 57.53% ramas y 65.04% funciones. Backend OMR: 79/79 pruebas focales pasan; metricasDatasetOmr.ts: 96.39% sentencias, 98% líneas, 86.31% ramas y 94.73% funciones. (2026-09-24T10:56:11.863Z)
- [ok] validation: Se añadió aserción UI para las clases CSS omr-experimental-note y omr-experimental-note__badge; npm run guard:wcag -- --skip-lint pasó 20/20 pares, y contraste directo del aviso: 8.36:1 claro, 13.09:1 oscuro, badge 7.79:1 en ambos temas. docs:check y sdd:audit pasan. (2026-09-24T10:56:11.863Z)
- [ok] implementation: Se incorporó el agregador OMR por contenido, folio/página y reactivo únicos; la UI marca rescates heurísticos y QR no verificado como experimentales; SPEC-062 quedó en 1.14.0 y se actualizó con la clasificación de alcance y cobertura focal vigente. (2026-09-24T10:56:11.863Z)
- [ok] validation: Suite focal OMR/QR/PDF: 105 pruebas en 7 archivos; revisión UI OMR: 9/9; backend y frontend tsc directos, ESLint focalizado, WCAG 20/20 y sdd:audit pasan. (2026-09-24T10:56:11.863Z)
- [ok] validation: App Host contracts 6/6 y sincronización entre equipos con SQLite temporal 15/15; no representa nube/OneDrive física ni cuenta Google real. (2026-09-24T10:56:11.863Z)
- [ok] validation: Runner OMR real ejecutado con una foto: 1 archivo, 1 página, 11 reactivos, 11/11 estados, 11/11 concordantes con etiquetas existentes, 0 conflictos y 0 errores; QR no detectado. Reporte solo en Temp, sin escrituras de calificaciones. (2026-09-24T10:56:11.863Z)
- [ok] validation: Trazabilidad IA/handoff 7/7 y 11/11; pipeline-contract y docs-check pasan después de regenerar documentación autogenerada. (2026-09-24T10:56:11.863Z)
- [ok] validation: Cobertura focal real con Vitest/V8: metricasDatasetOmr.ts 98% líneas, 86.31% ramas, 94.73% funciones (8/8 tests); SeccionEscaneo.tsx 61.78% líneas, 57.53% ramas, 65.04% funciones (9/9 tests). No es cobertura global ni exhaustiva del componente. (2026-09-24T10:56:11.863Z)
- [ok] documentation: SPEC-062 clasifica validado asistido vs. heurísticas/QR experimentales y registra el cierre del alcance candidato; docs:check y sdd:audit pasan después del cambio. (2026-09-24T10:56:11.863Z)
- [ok] validation: Reejecución actual de omr-qr-preprint-check a 300 DPI: QR exacto 32/32 páginas PDF (8/8 Diseño y Desarrollo, 24/24 Inteligencia de Negocios). Fotos: 2/39 capturas exactas, ambas C5051CA1/P2; 1/32 páginas únicas. El proceso retorna exit 1 correctamente porque datasetQrCompleto=false; el 0/32 de la traza anterior es histórico de otra corrida/configuración. (2026-09-24T10:56:11.863Z)
- [ok] validation: npm run test:release:policy: 31/31 pasan. No verifica CI remoto, release real ni gates integrales. (2026-09-24T10:56:11.863Z)
- [ok] documentation: Se reconciliaron docs/VERSIONADO.md y docs/RELEASE_STATUS.md con el checkout 1.1.6-14-g3337afd8-dirty, tag local v1.1.6, vista pública que lista v1.1.1 Latest y límite de GitHub CLI sin autenticar. docs:check y git diff --check pasan. (2026-09-24T10:56:11.863Z)

## Archivos leidos
- Sin lecturas registradas.

## Archivos cambiados
- .github/workflows/autogen-docs.yml
- .github/workflows/ci-backend.yml
- .github/workflows/ci-docs.yml
- .github/workflows/ci-frontend.yml
- .github/workflows/ci-installer-windows.yml
- .github/workflows/ci-policy-audit.yml
- .github/workflows/ci-portal.yml
- .github/workflows/ci.yml
- .github/workflows/pages-marketing.yml
- .github/workflows/release-beta.yml
- .github/workflows/release-stable-gate.yml
- .github/workflows/security-codeql.yml
- apps/backend/package-lock.json
- apps/backend/package.json
- apps/backend/prisma/schema.prisma
- apps/backend/reports/qa/latest/global-grade.json
- apps/backend/scripts/omr-sweep-geometria.ts
- apps/backend/src/compartido/robustez/soporteRetry.ts
- apps/backend/src/infraestructura/baseDatos/sqlite.ts
- apps/backend/src/infraestructura/seguridad/rbac.ts
- apps/backend/src/modulos/modulo_analiticas/controladorAnaliticas.ts
- apps/backend/src/modulos/modulo_analiticas/rutasAnaliticas.ts
- apps/backend/src/modulos/modulo_analiticas/servicioExportacionXlsxCalificaciones.ts
- apps/backend/src/modulos/modulo_analiticas/servicioListaAcademica.ts
- apps/backend/src/modulos/modulo_analiticas/tiposListaAcademica.ts
- apps/backend/src/modulos/modulo_asistencias/controladorAsistencias.ts
- apps/backend/src/modulos/modulo_autenticacion/middlewareAutenticacion.ts
- apps/backend/src/modulos/modulo_banco_preguntas/controladorBancoPreguntas.ts
- apps/backend/src/modulos/modulo_banco_preguntas/rutasBancoPreguntas.ts
- apps/backend/src/modulos/modulo_banco_preguntas/validacionesBancoPreguntas.ts
- apps/backend/src/modulos/modulo_calificacion/controladorCalificacion.ts
- apps/backend/src/modulos/modulo_calificacion/validacionesCalificacion.ts
- apps/backend/src/modulos/modulo_escaneo_omr/README.md
- apps/backend/src/modulos/modulo_escaneo_omr/controladorJobsOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCv.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omrCore.ts
- apps/backend/src/modulos/modulo_escaneo_omr/porFolioDataset.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generacionPlantillas.ts
- apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/previsualizacionPlantillas.ts
- apps/backend/src/modulos/modulo_generacion_pdf/domain/examenPdf.ts
- apps/backend/src/modulos/modulo_generacion_pdf/domain/layoutExamen.ts
- apps/backend/src/modulos/modulo_generacion_pdf/domain/qrExamen.ts
- apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
- apps/backend/src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.ts
- apps/backend/src/modulos/modulo_generacion_pdf/shared/tiposPdf.ts
- apps/backend/src/modulos/modulo_hidratacion_cursos/controladorHidratacionCursos.ts
- apps/backend/src/modulos/modulo_hidratacion_cursos/rutasHidratacionCursos.ts
- apps/backend/src/modulos/modulo_hidratacion_cursos/servicioHidratacionCursos.ts
- apps/backend/src/modulos/modulo_hidratacion_cursos/validacionesHidratacionCursos.ts
- apps/backend/src/modulos/modulo_listas_institucionales/servicioListasInstitucionales.ts
- apps/backend/src/modulos/modulo_sincronizacion_nube/domain/instantaneaLocal.ts
- apps/backend/src/modulos/modulo_sincronizacion_nube/domain/paqueteSincronizacion.ts
- apps/backend/src/modulos/modulo_sincronizacion_nube/infra/omrCapturas.ts
- apps/backend/src/modulos/modulo_sincronizacion_nube/sincronizacionInterna.ts
- apps/backend/tests/bancoPreguntas.controlador.test.ts
- apps/backend/tests/integracion/_flujoDocenteHelper.ts
- apps/backend/tests/integracion/asistencia.reglas.test.ts
- apps/backend/tests/integracion/classroom.v2.test.ts
- apps/backend/tests/integracion/hidratacionCursos.test.ts
- apps/backend/tests/integracion/listaAcademicaContratos.test.ts
- apps/backend/tests/integracion/listasInstitucionales.test.ts
- apps/backend/tests/integracion/omrJobsWorkflow.test.ts
- apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
- apps/backend/tests/integracion/rolesPermisos.test.ts
- apps/backend/tests/omr.core.decision.test.ts
- apps/backend/tests/omr.geometry.reference.test.ts
- apps/backend/tests/omr.test.ts
- apps/backend/tests/pdf.canonico.test.ts
- apps/backend/tests/pdf.layout.visual.guard.test.ts
- apps/backend/tests/pdf.paridad.test.ts
- apps/backend/tests/qr.examen.test.ts
- apps/backend/tests/setup.ts
- apps/backend/tests/sincronizacion.test.ts
- apps/backend/tests/utils/mongo.ts
- apps/frontend/package-lock.json
- apps/frontend/package.json
- apps/frontend/src/apps/app_docente/AppDocente.tsx
- apps/frontend/src/apps/app_docente/SeccionAsistencias.tsx
- apps/frontend/src/apps/app_docente/SeccionBanco.tsx
- apps/frontend/src/apps/app_docente/SeccionCalificaciones.tsx
- apps/frontend/src/apps/app_docente/SeccionCalificar.tsx
- apps/frontend/src/apps/app_docente/SeccionClassroom.tsx
- apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx
- apps/frontend/src/apps/app_docente/SeccionPeriodos.tsx
- apps/frontend/src/apps/app_docente/SeccionRegistroEntrega.tsx
- apps/frontend/src/apps/app_docente/features/banco/components/BancoFormularioPregunta.tsx
- apps/frontend/src/apps/app_docente/features/banco/components/BancoListadoPreguntas.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions.ts
- apps/frontend/src/apps/app_docente/hooks/usePermisosDocente.ts
- apps/frontend/src/apps/app_docente/hooks/useRecordatorioPaseLista.ts
- apps/frontend/src/apps/app_docente/tipos.ts
- apps/frontend/src/apps/app_docente/utilidades.ts
- apps/frontend/src/styles.css
- apps/frontend/src/styles/cards.css
- apps/frontend/src/styles/screens.css
- apps/frontend/src/tipos/tesseract-js.d.ts
- apps/frontend/src/ui/iconos.tsx
- apps/frontend/src/ui/version/VersionInfoPage.tsx
- apps/frontend/tests/appDocente.previewConsolidado.test.tsx
- apps/frontend/tests/banco.refactor.test.tsx
- apps/frontend/tests/escaneo.refactor.test.tsx
- apps/frontend/tests/gui.responsive.contract.test.tsx
- apps/frontend/tests/plantillas.hooks.test.tsx
- apps/frontend/tests/plantillas.refactor.test.tsx
- apps/frontend/tests/seccionAsistencias.test.tsx
- apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx
- apps/frontend/tests/seccionClassroom.test.tsx
- apps/frontend/tests/seccionPaqueteSincronizacion.test.tsx
- apps/frontend/tests/utilidades.appDocente.test.ts
- apps/frontend/tests/versionInfo.helpers.test.tsx
- apps/frontend/tests/versionInfoPage.test.tsx
- apps/frontend/vite.config.ts
- apps/portal_alumno_cloud/package-lock.json
- apps/portal_alumno_cloud/package.json
- apps/portal_alumno_cloud/prisma/schema.prisma
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/browser.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/client.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/commonInputTypes.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/enums.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/class.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/prismaNamespace.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/internal/prismaNamespaceBrowser.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/AgendaAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/AvisoAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/CodigoAcceso.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/EventoUsoAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/HistorialAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/MateriaAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/PaqueteSyncDocente.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/PerfilAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/ResultadoAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/SesionAlumno.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/generado/cliente/models/SolicitudRevision.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/sqlite.ts
- apps/portal_alumno_cloud/tests/utils/mongo.ts
- config/version-catalog.json
- docs/AUTO_DOCS_INDEX.md
- docs/AUTO_ENV.md
- docs/INVENTARIO_CODIGO_EXHAUSTIVO.md
- docs/RELEASE_STATUS.md
- docs/VERSIONADO.md
- docs/WCAG_UI_POLICY.md
- docs/specs/SPEC-036_autenticacion_guardrails.spec.md
- docs/specs/SPEC-039_asistencias_seguimiento.spec.md
- docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md
- docs/specs/SPEC-046_google_classroom_sync.spec.md
- docs/specs/SPEC-054_identidad_visual_frontend_completa.spec.md
- docs/specs/e2e_playwright_screen_functional_matrix.spec.md
- docs/specs/flujo_docente_alumno_integral.spec.md
- docs/specs/listas_institucionales_por_plantilla.spec.md
- package-lock.json
- package.json
- packaging/app-host/MainWindow.xaml.cs
- packaging/wix/BurnBootstrapperApp/EvaluaPro.BurnBootstrapperApp.csproj
- packaging/wix/README.md
- scripts/build-msi.ps1
- scripts/build-native-dist.ps1
- scripts/installer-burn/InstallerBurnHelper.ps1
- scripts/perf-collect-business.ts
- scripts/serve-docente-static.mjs
- scripts/start-docente-native.mjs
- scripts/testing/start-frontend-e2e-server.mjs
- scripts/tests/app-host-shutdown.contract.test.mjs
- scripts/tests/ci-workflow-contract.test.mjs
- scripts/tests/installer-hub-contract.test.mjs
- scripts/tests/native-startup.contract.test.mjs
- scripts/tests/omr-version-policy.test.mjs
- scripts/tests/seed-docente-dummy.mjs
- scripts/tests/wix-version-policy.test.mjs
- tests/gui-responsive/ciclo-completo.spec.ts
- tests/gui-responsive/journey-docente-integral.spec.ts
- tests/gui-responsive/playwright.ciclo.config.mjs
- apps/backend/prisma.config.mjs
- apps/backend/scripts/omr-eval-real-dataset.mjs
- apps/backend/scripts/omr-qr-preprint-check.ts
- apps/backend/src/modulos/modulo_banco_preguntas/controladorReactivos.ts
- apps/backend/src/modulos/modulo_banco_preguntas/reactivosContrato.ts
- apps/backend/src/modulos/modulo_banco_preguntas/reactivosXlsx.ts
- apps/backend/src/modulos/modulo_banco_preguntas/servicioCalibracionReactivos.ts
- apps/backend/src/modulos/modulo_banco_preguntas/servicioReactivos.ts
- apps/backend/src/modulos/modulo_escaneo_omr/infra/metricasDatasetOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/
- apps/backend/tests/calificacion.omr.estado.test.ts
- apps/backend/tests/integracion/reactivosIngesta.test.ts
- apps/backend/tests/listaAcademicaResumen.test.ts
- apps/backend/tests/omr.consenso.robusto.test.ts
- apps/backend/tests/omr.dataset-grain.test.ts
- apps/backend/tests/omr.estado-respuesta.test.ts
- apps/backend/tests/omr.qr.preimpresion.test.ts
- apps/backend/tests/reactivosCalibracion.test.ts
- apps/backend/tests/reactivosContrato.test.ts
- apps/frontend/src/apps/app_docente/ConsultaCalificaciones.tsx
- apps/frontend/src/apps/app_docente/SolicitudesRevisionPanel.tsx
- apps/frontend/src/apps/app_docente/features/banco/components/BancoImportacionReactivos.tsx
- apps/frontend/src/apps/app_docente/fechaLocal.ts
- apps/frontend/src/apps/app_docente/ocrTexto.ts
- apps/frontend/src/ui/IconoLucide.tsx
- apps/frontend/src/ui/iconosCatalogo.ts
- apps/frontend/src/ui/version/changelog.ts
- apps/frontend/src/ui/version/legal/
- apps/frontend/tests/bancoImportacionReactivos.test.tsx
- apps/frontend/tests/changelog.test.ts
- apps/frontend/tests/fechaLocal.test.ts
- apps/frontend/tests/ocrTexto.test.ts
- apps/frontend/tests/permisosBanco.hooks.test.tsx
- apps/frontend/tests/seccionCalificaciones.resumen.test.tsx
- apps/portal_alumno_cloud/prisma.config.mjs
- docs/GUIA_ICONOGRAFIA.md
- docs/contracts/
- docs/handoff/sesiones/2026-09-23/
- docs/handoff/sesiones/2026-09-24/
- docs/qa/
- docs/specs/SPEC-059_consulta_calificaciones_por_alumno.spec.md
- docs/specs/SPEC-060_omr_consenso_captura_real.spec.md
- docs/specs/SPEC-061_banco_reactivos_ia_versionado.spec.md
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
- docs/specs/SPEC-063_omr_orientacion_y_inclinacion_pagina.spec.md
- docs/specs/SPEC-064_actualizacion_dependencias_toolchains.spec.md
- docs/specs/SPEC-065_ciclo_vida_servicios_app_host.spec.md
- docs/specs/SPEC-066_sqlite_test_isolation.spec.md
- global.json
- output/qa/EvaluaPro-omr-camera-dataset-camscanner-20260924.zip
- output/qa/EvaluaPro-omr-camera-dataset-camscanner-20260924.zip.sha256
- output/qa/omr-camera-camscanner-20260924/
- output/qa/omr-plantilla-sync-20260923.layout.json
- output/qa/omr-plantilla-sync-20260923.pdf
- scripts/migrate-reactivos-backfill.mjs
- scripts/migrate-reactivos-sqlite.mjs
- scripts/tests/dependency-toolchain-policy.test.mjs
- scripts/tests/migrate-reactivos-backfill.test.mjs
- scripts/tests/migrate-reactivos-sqlite.test.mjs
- storage/omr_debug/058868F3/
- storage/omr_debug/1458887E/
- storage/omr_debug/5AFC1D79/
- storage/omr_debug/780DC77D/
- storage/omr_debug/DCA5097F/
- storage/omr_debug/E2FAFF07/
- storage/omr_debug/EE26CF1C/
- tests/gui-responsive/banco-reactivos.spec.ts

## Validacion ejecutada
- lint: `npm run lint` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- typecheck: `npm run typecheck` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_frontend_ci: `npm run test:frontend:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_coverage_ci: `npm run test:coverage:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_tdd_enforcement_ci: `npm run test:tdd:enforcement:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_backend_ci: `npm run test:backend:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_portal_ci: `npm run test:portal:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- perf_check: `npm run perf:check` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- pipeline_contract_check: `npm run pipeline:contract:check` -> ok (exitCode=0, duracionMs=618)
  resultado: ✔ ext_perf_arquitectura prepara sharp antes de perf:check (2.7494ms) | ✔ ext_funcionales usa el gate OMR canónico (0.2725ms) | ✔ ext_funcionales ejecuta PDF print y visual juntos (0.2492ms) | ✔ ext_funcionales conserva quality visual y journeys para UX (0.2512ms) | ... | npm notice run evaluapro@1.1.6 pipeline:contract:check | npm notice run node scripts/pipeline-contract-check.mjs
- docs_check: `npm run docs:check` -> ok (exitCode=0, duracionMs=899)
  resultado: [docs] ok | npm notice run evaluapro@1.1.6 docs:check | npm notice run node scripts/docs.mjs --check

## Decisiones
- El grano de evaluación fotográfica es folio/página/reactivo; recapturas no inflan el denominador.
- Separar concordancia detector-etiqueta del acierto del alumno contra la clave.
- Mantener heurísticas de rescate y fallback QR como experimentales con revisión docente.
- No promover la versión mientras sigan activos hilos, manifiesto QA obsoleto y gates sin evidencia actual.

## Supuestos
- Las pruebas de sincronización usan SQLite temporal y datos sintéticos según sus fixtures actuales.
- El último reporte fotográfico existente fue generado después de la modificación actual del motor CV; esta sesión recalculó sus métricas sin reejecutar el detector.

## Riesgos abiertos
- El hilo de listas/calificaciones concluyó sus pruebas locales, pero no validó Classroom real, el libro físico ni el bundle instalado; el checkout compartido conserva cambios de múltiples áreas.
- No se verificó Classroom real, conciliación con libro físico, sincronización física OneDrive ni bundle instalado.
- El QR fotográfico exacto se observa solo en 1 de 32 páginas únicas; hay una discrepancia OMR-etiqueta.
- No se ejecutaron cobertura global, tests CI completos, benchmark fotográfico completo ni release gate actual; el componente de revisión tiene 61.78% de cobertura de líneas focalizada.
- El checkout tiene 238 rutas sucias; `gh api` no pudo verificar Actions/tags remotos por falta de autenticación CLI. No se solicitó ni mostró ninguna credencial.
- Las fotos solo se incluyen en snapshot 1:1 si residen bajo examenes; una raíz externa no está integrada al snapshot genérico.

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
 M apps/backend/src/modulos/modulo_analiticas/servicioExportacionXlsxCalificaciones.ts
 M apps/backend/src/modulos/modulo_analiticas/servicioListaAcademica.ts
 M apps/backend/src/modulos/modulo_analiticas/tiposListaAcademica.ts
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
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/examenPdf.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/layoutExamen.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/domain/qrExamen.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.ts
 M apps/backend/src/modulos/modulo_generacion_pdf/shared/tiposPdf.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/controladorHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/rutasHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/servicioHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_hidratacion_cursos/validacionesHidratacionCursos.ts
 M apps/backend/src/modulos/modulo_listas_institucionales/servicioListasInstitucionales.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/domain/instantaneaLocal.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/domain/paqueteSincronizacion.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/infra/omrCapturas.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/sincronizacionInterna.ts
 M apps/backend/tests/bancoPreguntas.controlador.test.ts
 M apps/backend/tests/integracion/_flujoDocenteHelper.ts
 M apps/backend/tests/integracion/asistencia.reglas.test.ts
 M apps/backend/tests/integracion/classroom.v2.test.ts
 M apps/backend/tests/integracion/hidratacionCursos.test.ts
 M apps/backend/tests/integracion/listaAcademicaContratos.test.ts
 M apps/backend/tests/integracion/listasInstitucionales.test.ts
 M apps/backend/tests/integracion/omrJobsWorkflow.test.ts
 M apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
 M apps/backend/tests/integracion/rolesPermisos.test.ts
 M apps/backend/tests/omr.core.decision.test.ts
 M apps/backend/tests/omr.geometry.reference.test.ts
 M apps/backend/tests/omr.test.ts
 M apps/backend/tests/pdf.canonico.test.ts
 M apps/backend/tests/pdf.layout.visual.guard.test.ts
 M apps/backend/tests/pdf.paridad.test.ts
 M apps/backend/tests/qr.examen.test.ts
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
 M apps/frontend/src/apps/app_docente/SeccionRegistroEntrega.tsx
 M apps/frontend/src/apps/app_docente/features/banco/components/BancoFormularioPregunta.tsx
 M apps/frontend/src/apps/app_docente/features/banco/components/BancoListadoPreguntas.tsx
 M apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion.tsx
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
 M docs/AUTO_DOCS_INDEX.md
 M docs/AUTO_ENV.md
 M docs/INVENTARIO_CODIGO_EXHAUSTIVO.md
 M docs/RELEASE_STATUS.md
 M docs/VERSIONADO.md
 M docs/WCAG_UI_POLICY.md
 M docs/specs/SPEC-036_autenticacion_guardrails.spec.md
 M docs/specs/SPEC-039_asistencias_seguimiento.spec.md
 M docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md
 M docs/specs/SPEC-046_google_classroom_sync.spec.md
 M docs/specs/SPEC-054_identidad_visual_frontend_completa.spec.md
 M docs/specs/e2e_playwright_screen_functional_matrix.spec.md
 M docs/specs/flujo_docente_alumno_integral.spec.md
 M docs/specs/listas_institucionales_por_plantilla.spec.md
 M package-lock.json
 M package.json
 M packaging/app-host/MainWindow.xaml.cs
 M packaging/wix/BurnBootstrapperApp/EvaluaPro.BurnBootstrapperApp.csproj
 M packaging/wix/README.md
 M scripts/build-msi.ps1
 D scripts/build-native-dist.ps1
 M scripts/installer-burn/InstallerBurnHelper.ps1
 M scripts/perf-collect-business.ts
 M scripts/serve-docente-static.mjs
 M scripts/start-docente-native.mjs
 M scripts/testing/start-frontend-e2e-server.mjs
 M scripts/tests/app-host-shutdown.contract.test.mjs
 M scripts/tests/ci-workflow-contract.test.mjs
 M scripts/tests/installer-hub-contract.test.mjs
 M scripts/tests/native-startup.contract.test.mjs
 M scripts/tests/omr-version-policy.test.mjs
 M scripts/tests/seed-docente-dummy.mjs
 M scripts/tests/wix-version-policy.test.mjs
 M tests/gui-responsive/ciclo-completo.spec.ts
 M tests/gui-responsive/journey-docente-integral.spec.ts
 M tests/gui-responsive/playwright.ciclo.config.mjs
?? apps/backend/prisma.config.mjs
?? apps/backend/scripts/omr-eval-real-dataset.mjs
?? apps/backend/scripts/omr-qr-preprint-check.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/controladorReactivos.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/reactivosContrato.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/reactivosXlsx.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/servicioCalibracionReactivos.ts
?? apps/backend/src/modulos/modulo_banco_preguntas/servicioReactivos.ts
?? apps/backend/src/modulos/modulo_escaneo_omr/infra/metricasDatasetOmr.ts
?? apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/
?? apps/backend/tests/calificacion.omr.estado.test.ts
?? apps/backend/tests/integracion/reactivosIngesta.test.ts
?? apps/backend/tests/listaAcademicaResumen.test.ts
?? apps/backend/tests/omr.consenso.robusto.test.ts
?? apps/backend/tests/omr.dataset-grain.test.ts
?? apps/backend/tests/omr.estado-respuesta.test.ts
?? apps/backend/tests/omr.qr.preimpresion.test.ts
?? apps/backend/tests/reactivosCalibracion.test.ts
?? apps/backend/tests/reactivosContrato.test.ts
?? apps/frontend/src/apps/app_docente/ConsultaCalificaciones.tsx
?? apps/frontend/src/apps/app_docente/SolicitudesRevisionPanel.tsx
?? apps/frontend/src/apps/app_docente/features/banco/components/BancoImportacionReactivos.tsx
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
?? apps/frontend/tests/seccionCalificaciones.resumen.test.tsx
?? apps/portal_alumno_cloud/prisma.config.mjs
?? docs/GUIA_ICONOGRAFIA.md
?? docs/contracts/
?? docs/handoff/sesiones/2026-09-23/
?? docs/handoff/sesiones/2026-09-24/
?? docs/qa/
?? docs/specs/SPEC-059_consulta_calificaciones_por_alumno.spec.md
?? docs/specs/SPEC-060_omr_consenso_captura_real.spec.md
?? docs/specs/SPEC-061_banco_reactivos_ia_versionado.spec.md
?? docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
?? docs/specs/SPEC-063_omr_orientacion_y_inclinacion_pagina.spec.md
?? docs/specs/SPEC-064_actualizacion_dependencias_toolchains.spec.md
?? docs/specs/SPEC-065_ciclo_vida_servicios_app_host.spec.md
?? docs/specs/SPEC-066_sqlite_test_isolation.spec.md
?? global.json
?? output/qa/EvaluaPro-omr-camera-dataset-camscanner-20260924.zip
?? output/qa/EvaluaPro-omr-camera-dataset-camscanner-20260924.zip.sha256
?? output/qa/omr-camera-camscanner-20260924/
?? output/qa/omr-plantilla-sync-20260923.layout.json
?? output/qa/omr-plantilla-sync-20260923.pdf
?? scripts/migrate-reactivos-backfill.mjs
?? scripts/migrate-reactivos-sqlite.mjs
?? scripts/tests/dependency-toolchain-policy.test.mjs
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
```

## Siguiente paso recomendado
- Ejecutar gates globales y benchmark completo únicamente tras autorización expresa; obtener comprobación autenticada de streak/tags remotos, validar Classroom real y bundle instalado, y definir alcance de sincronización de fotos antes de reevaluar Go/No-Go.

## Artefactos generados
- docs/handoff/sesiones/2026-09-24/cierre-version-estable-20260924.json
- docs/handoff/sesiones/2026-09-24/cierre-version-estable-20260924.md

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
