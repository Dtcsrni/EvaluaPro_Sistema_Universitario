# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: omr-qr-reference-audit-20260924
- parentSessionId: omr-rescate-alto-contraste-20260924
- status: final
- generatedAt: 2026-09-24T06:53:42.675Z
- validationProfile: quick

## Agente
- name: unknown
- version: unknown
- provider: unknown
- kind: unknown
- channel: unknown

## Solicitud
- Mejorar QR OMR y comparar siempre fotografías con las referencias PDF preimpresión.

## Objetivo
- Auditar legibilidad QR histórica y reforzar la validación automatizada de QR en la plantilla nueva, manteniendo identidad exacta y evitando mapeos inseguros.

## Alcance
- Auditoría QR rasterizada de los dos PDF originales y dataset fotográfico
- Regresión de rasterización 300 DPI para PDF de 25 reactivos
- Diagnóstico separado de QR ausente, payload distinto y coincidencia exacta
- Continuidad de mejora de microcomponentes OMR

## Restricciones
- La clave y etiquetas se usan solo para evaluar, nunca durante detección.
- No escribir calificaciones ni registros de alumnos.
- No cambiar letras ya emitidas ni introducir marcas en hojas vacías.
- No afirmar 100% con abstenciones, discrepancias o QR no detectados.

## Acciones
- [ok] implementation: El informe preimpresión separa detección del payload, igualdad exacta y páginas sin lectura; se añadió prueba de los tres estados. Prueba PDF ahora rasteriza y decodifica las dos páginas compactas de 25 reactivos. (2026-09-24T06:53:42.674Z)
- [ok] validation: Auditoría a 300 DPI: PDF Diseño y Desarrollo 0/8 QR detectados; Inteligencia de Negocios 0/24; fotos 0/38. Ningún payload detectado distinto; todos quedaron ausentes. La plantilla compacta actual de 25 reactivos pasa 2/2 páginas en prueba PDF rasterizada; control de 7 reactivos 1/1. (2026-09-24T06:53:42.674Z)
- [ok] validation: OMR dataset: 38 procesadas, 1 sin identidad, 499/499 estados, 471 letras, 1 ambigua, 27 sin marca, 470/471 acuerdo visual condicionado. Solo 058868F3 P2 Q19 se resolvió a E; exámenes vacíos 10/10 y 15/15 intactos. (2026-09-24T06:53:42.674Z)
- [ok] validation: 26 pruebas OMR/PDF/QR aprobadas, ESLint focal y tsc directo aprobados; sdd:audit, traceability y handoff aprobados. No se probó impresión física. (2026-09-24T06:53:42.674Z)
- [ok] documentation: SPEC-062 REQ-015 y REQ-017 actualizados con evidencia y límites. (2026-09-24T06:53:42.674Z)

## Archivos leidos
- AGENTS.md
- apps/backend/scripts/omr-qr-preprint-check.ts
- apps/backend/tests/omr.qr.preimpresion.test.ts
- apps/backend/tests/pdf.canonico.test.ts
- apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts
- apps/backend/src/modulos/modulo_generacion_pdf/domain/qrExamen.ts
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md

## Archivos cambiados
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/scripts/omr-qr-preprint-check.ts
- apps/backend/tests/omr.estado-respuesta.test.ts
- apps/backend/tests/omr.qr.preimpresion.test.ts
- apps/backend/tests/pdf.canonico.test.ts
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md

## Validacion ejecutada
- qr_omr_tests: `vitest run tests/omr.qr.preimpresion.test.ts tests/pdf.canonico.test.ts tests/omr.estado-respuesta.test.ts` -> ok (exitCode=0, duracionMs=4340)
  resultado: 3 archivos, 26 pruebas aprobadas; incluye raster 300 DPI exacto en plantilla compacta.
- eslint_focal: `npx eslint [archivos OMR/QR/PDF] --max-warnings=0` -> ok (exitCode=0, duracionMs=3651)
  resultado: Sin errores.
- tsc_directo: `tsc --noEmit --project apps/backend/tsconfig.json --pretty false` -> ok (exitCode=0, duracionMs=10000)
  resultado: TypeScript sin errores.
- qr_preimpresion: `node --import tsx scripts/omr-qr-preprint-check.ts [2 PDF originales] --benchmark-report [reporte OMR] --dpi 300` -> falla (exitCode=1, duracionMs=67200)
  resultado: 0/32 PDF históricos y 0/38 fotos: QR no detectados. Control template de 25 preguntas pasa 2/2 en prueba automatizada.

## Decisiones
- No aceptar identidad si el payload QR no se detecta y valida; el mapeo de benchmark solo sirve para evaluación.
- Mantener reducción compacta de payload firmado para plantillas nuevas y verificar raster antes de imprimir.
- Claves y etiquetas se usan solo post hoc para OMR.

## Supuestos
- La plantilla nueva a 300 DPI no sustituye una prueba de impresión y captura física.
- La fuente visual de etiquetas no equivale a verdad terreno independiente.

## Riesgos abiertos
- El QR de fotos históricas no se recupera: 0/38; una foto tampoco tiene identidad resuelta.
- Los PDF fuente originales fallan la auditoría 0/32; no reimprimirlos.
- Persiste una discrepancia de etiqueta revisada visualmente; acuerdo OMR condicionado 470/471, no 100%.
- Plantilla compacta probada solo por raster digital, no en papel/cámara.

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
- Generar nuevos lotes con plantilla compacta; imprimir y capturar una muestra física representativa, comparar QR exacto pre/postimpresión y desarrollar una ruta segura para las referencias históricas si hace falta recuperar su identidad.

## Artefactos generados
- C:/Users/evega/AppData/Local/Temp/omr-q19-high-contrast-20260924.json
- C:/Users/evega/AppData/Local/Temp/omr-full-high-contrast-rescue-20260924.json

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
