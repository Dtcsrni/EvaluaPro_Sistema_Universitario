# Handoff IA - Continuación OMR copias compartidas

- traceSchemaVersion: 1.0.0
- sessionId: omr-shared-copies-e2e-followup-2026-10-27
- parentSessionId: omr-source-dedup-2026-10-27
- status: final
- generatedAt: 2026-10-27T22:43:33Z
- validationProfile: targeted

## Objetivo

- Cerrar el hueco de integración de SPEC-128 sin habilitar escritura automática general ni registrar calificaciones.

## Cambios

- Se aumentó el límite de campos multipart de 2 a 3 para admitir `sharedFormCopies` junto con `generatedAssessmentId` y `clientRequestId`.
- Se añadió una prueba HTTP que ingresa dos capturas sintéticas del mismo QR, confirma dos `submissionId` distintos, lista alumnos del grupo y verifica que calificar sin identidades confirmadas falla sin crear calificaciones.
- La misma prueba simula explícitamente revisión humana aceptada para aislar la API de asignación: una sola copia obtiene el alumno cuando hay dos solicitudes concurrentes; el segundo alumno se asigna a la copia restante y el readback se coteja por `submissionId`.
- Se actualizó la matriz de trazabilidad de SPEC-128 para marcar alcance parcial y distinguir pruebas sintéticas de evidencia real.

## Validación ejecutada

- `npm -C apps/backend run test -- --run tests/integracion/omrJobsWorkflow.test.ts -t "separa copias del mismo formulario"` -> exit 0; 1 prueba aprobada, 14 omitidas por filtro.
- Tras añadir la comprobación de concurrencia y readback, se repitió el mismo E2E -> exit 0; 1 prueba aprobada, 14 omitidas por filtro.
- `npm -C apps/backend run test -- --run tests/copiasFormularioOmr.test.ts tests/rasterizadorIngestaPdfOmr.test.ts` -> exit 0; 2 archivos y 8 pruebas aprobadas.
- `npx eslint apps/backend/src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.ts apps/backend/tests/integracion/omrJobsWorkflow.test.ts --max-warnings=0` -> exit 0.
- `npm -C apps/backend run typecheck` -> exit 0; Prisma Client generado y TypeScript sin errores.

## Límites y pendientes

- La prueba integra formularios sintéticos; no demuestra precisión OMR ni concordancia contra verdad terreno humana.
- El gate poblacional de autocalificación sigue cerrado por falta del conjunto real etiquetado independientemente.
- La asignación se verificó con estado revisado sembrado por la prueba; falta demostrar que el lector OMR alcance ese estado con respuestas contestadas, y faltan E2E de compatibilidad de clave/variante y resultados separados por intento.
- El generador de lotes intenta evitar huellas de variante repetidas mientras sea posible (`generacionPlantillas.ts`: `firmasVariantesLote` y reintento). Las copias del mismo formulario pueden carecer de alumnos compatibles dentro del lote; se solicitó definir un modo explícito de lote con variante compartida antes de cambiar la generación.
- No se desplegó este cambio, no se sincronizó con la instalación activa y no se escribieron calificaciones.
