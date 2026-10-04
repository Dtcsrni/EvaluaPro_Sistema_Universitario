# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: omr-nucleo-qr-focal-20260924
- parentSessionId: omr-rescate-alto-contraste-20260924
- status: final
- generatedAt: 2026-09-24T07:40:57.782Z
- validationProfile: quick

## Agente
- name: unknown
- version: unknown
- provider: unknown
- kind: unknown
- channel: unknown

## Solicitud
- Continuar la mejora del OMR real, reducir revisión manual y elevar lectura QR contrastando preimpresión.

## Objetivo
- Rescatar marcas tenues sin falsos positivos en el dataset actual y registrar evidencia para continuar hacia 100%.

## Alcance
- Regla OMR por núcleo tenue y componente compacta.
- Benchmark integral y controles vacíos.
- Diagnóstico experimental QR contrastado con payload de referencia.

## Restricciones
- Clave/etiquetas solo post hoc.
- No modificar calificaciones ni registros de alumnos.
- No aceptar QR sin coincidencia exacta.
- No afirmar 100% ni generalización sin evidencia.

## Acciones
- [ok] implementation: Rescate estricto por margen de oscuridad del núcleo, relleno y componente compacta centrada; excluye respuesta existente, doble y tachadura. (2026-09-24T07:40:57.782Z)
- [ok] validation: 499/499 estados: 472 letras, 0 ambiguas, 27 sin marca, 0 errores. Único cambio C5051CA1 P1 Q7 ambigua a E. Dos controles vacíos 10/10 y 15/15 sin marcas. Etiquetas guardadas: 471/472; D6930C3E P2 Q18 visualmente E, igual a OMR/clave, frente a etiqueta guardada D. (2026-09-24T07:40:57.782Z)
- [ok] validation: QR productivo 0/38. Experimento nativo obtuvo payload exacto en dos archivos byte-idénticos de una página; 37 otros sin lectura, 0 falsos. Sin promoción a producción. (2026-09-24T07:40:57.782Z)
- [ok] documentation: Trazas REQ-015 y REQ-017 actualizadas con métricas y límites. (2026-09-24T07:40:57.782Z)

## Archivos leidos
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/tests/omr.estado-respuesta.test.ts
- apps/backend/scripts/omr-eval-real-dataset.mjs
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md

## Archivos cambiados
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/tests/omr.estado-respuesta.test.ts
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md

## Validacion ejecutada
- omr_unit: `npx vitest run tests/omr.estado-respuesta.test.ts` -> ok (exitCode=0, duracionMs=480)
  resultado: 1 archivo; 16 pruebas aprobadas.
- eslint_focal: `npx eslint src/modulos/modulo_escaneo_omr/servicioOmrCv.ts tests/omr.estado-respuesta.test.ts` -> ok (exitCode=0, duracionMs=3524)
  resultado: Sin errores.
- typecheck: `npx tsc --noEmit --project tsconfig.json --pretty false` -> ok (exitCode=0, duracionMs=10004)
  resultado: TypeScript sin errores.
- dataset_full: `node --import tsx scripts/omr-eval-real-dataset.mjs` -> ok (exitCode=0, duracionMs=844782)
  resultado: 38 procesadas, 1 duplicado exacto omitido; 499/499 estados, 472 determinadas, 0 ambiguas, 27 sin marca; 2 páginas vacías conservadas; QR 0/38; errores 0.
- sdd_audit: `npm run sdd:audit` -> ok (exitCode=0, duracionMs=1000)
  resultado: Auditoría SDD aprobada.
- ia_trace_tests: `npm run test:ia:traceability` -> ok (exitCode=0, duracionMs=1000)
  resultado: 7 pruebas aprobadas.
- ia_handoff_tests: `npm run test:ia:handoff` -> ok (exitCode=0, duracionMs=1000)
  resultado: 11 pruebas aprobadas.
- scoped_diff_check: `git diff --check -- [3 archivos OMR/SPEC]` -> falla (exitCode=1, duracionMs=300)
  resultado: Whitespace en líneas en blanco servicioOmrCv.ts:3300 y 3307; fuera de la edición focal.

## Decisiones
- La clave y etiquetas se usan solo post hoc.
- El rescate exige núcleo dominante y rasgos espaciales compactos.
- QR nativo no se activa por falta de generalización.

## Supuestos
- Las etiquetas del dataset son referencia imperfecta, no ground truth independiente.

## Riesgos abiertos
- QR productivo aún 0/38.
- Una discrepancia de etiqueta apunta a D vs E y requiere corregir/validar la fuente.
- Generalización a otros lotes no demostrada.
- Checkout contiene modificaciones ajenas extensas; solo se editaron tres archivos de alcance.

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
 M apps/backend/src/modulos/modulo_sincronizacion_nube/domain/instantaneaLocal.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/domain/paqueteSincronizacion.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/infra/omrCapturas.ts
 M apps/backend/src/modulos/modulo_sincronizacion_nube/sincronizacionInterna.ts
 M apps/backend/tests/bancoPreguntas.controlador.test.ts
 M apps/backend/tests/integracion/asistencia.reglas.test.ts
 M apps/backend/tests/integracion/hidratacionCursos.test.ts
 M apps/backend/tests/integracion/listaAcademicaContratos.test.ts
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
 M apps/backend/tests/sincronizacion.test.ts
 M apps/backend/tests/utils/mongo.ts
 M apps/frontend/package-lock.json
 M apps/frontend/package.json
 M apps/frontend/src/apps/app_docente/AppDocente.tsx
 M apps/frontend/src/apps/app_docente/SeccionAsistencias.tsx
 M apps/frontend/src/apps/app_docente/SeccionBanco.tsx
 M apps/frontend/src/apps/app_docente/SeccionCalificaciones.tsx
 M apps/frontend/src/apps/app_docente/SeccionCalificar.tsx
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
 M docs/WCAG_UI_POLICY.md
 M docs/specs/SPEC-036_autenticacion_guardrails.spec.md
 M docs/specs/SPEC-039_asistencias_seguimiento.spec.md
 M docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md
 M docs/specs/SPEC-054_identidad_visual_frontend_completa.spec.md
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
?? apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/
?? apps/backend/tests/calificacion.omr.estado.test.ts
?? apps/backend/tests/integracion/reactivosIngesta.test.ts
?? apps/backend/tests/listaAcademicaResumen.test.ts
?? apps/backend/tests/omr.consenso.robusto.test.ts
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
?? docs/specs/SPEC-059_consulta_calificaciones_por_alumno.spec.md
?? docs/specs/SPEC-060_omr_consenso_captura_real.spec.md
?? docs/specs/SPEC-061_banco_reactivos_ia_versionado.spec.md
?? docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
?? docs/specs/SPEC-063_omr_orientacion_y_inclinacion_pagina.spec.md
?? docs/specs/SPEC-064_actualizacion_dependencias_toolchains.spec.md
?? docs/specs/SPEC-065_ciclo_vida_servicios_app_host.spec.md
?? global.json
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
- Investigar ROI QR de resolución nativa y deduplicación con pruebas en páginas únicas; validar en el dataset completo y nuevas capturas.

## Artefactos generados
- C:/Users/evega/AppData/Local/Temp/omr-q7-nucleus-rescue-20260924.json
- C:/Users/evega/AppData/Local/Temp/omr-full-nucleus-rescue-20260924.json

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
