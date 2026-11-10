---
id: SPEC-044
titulo: Motor de Calificación OMR, Revisión Visual de Burbujas y Actas
version: 1.3.0
fecha: 2026-11-10
autor: Antigravity / EvaluaPro Team
modulo: modulo_calificaciones
estado: approved
---

## Contexto
Procesamiento óptico de marcas (OMR) mediante visión computacional, detección automática de respuestas marcadas, corrección visual interactiva de marcas dudosas y emisión de actas oficiales de notas.

## Requisitos Funcionales
- **REQ-001 (Análisis Óptico)**: Procesamiento de imágenes escaneadas/fotografiadas de hojas OMR.
- **REQ-002 (Revisión Visual)**: Interfaz con mapa de burbujas para verificar marcas dudosas.
- **REQ-003 (Actas de Calificaciones)**: Consolidación de notas parciales y finales.
- **REQ-004 (Contrato web OMR)**: La UI docente debe operar sobre rutas reales y autenticadas del backend para cargar un examen generado, crear un job de captura, resolver hojas y finalizar el job, sin rutas huérfanas.
- **REQ-005 (Persistencia de job)**: Cada job OMR debe conservar docente, examen, estado, progreso, páginas procesadas y resoluciones manuales; nunca debe mezclar datos de otro docente.
- **REQ-006 (PDF e imagen)**: El workflow debe aceptar imágenes y PDF; el PDF debe rasterizarse por página antes del análisis OMR y los errores de una captura deben quedar visibles sin ocultar el resultado de las demás.
- **REQ-007 (Confianza histórica)**: Cuando una respuesta histórica no tenga confianza almacenada, la UI debe mostrar “Sin dato de confianza”, excluirla de los promedios medidos y no describirla como 0% ni como baja confianza. La ausencia no se convierte en evidencia de lectura correcta: mantiene las guardas de revisión existentes. Una confianza numérica explícita de cero sigue representándose como 0% real.
- **REQ-008 (Respuestas incorrectas automáticas)**: En una página con identidad, geometría, calidad y cobertura suficientes, una respuesta en blanco, ambigua, con doble marca o tachada se registra como incorrecta sin exigir revisión manual. La confianza individual baja de una respuesta ambigua no bloquea por sí sola el puntaje; las respuestas marcadas como contestadas sí deben superar el umbral individual. La página permanece en revisión si falta estado de respuesta, hay cobertura insuficiente, geometría no confiable o calidad realmente ilegible. La clasificación y la evidencia original se conservan para auditoría.

## Criterios de Aceptación
1. El motor OMR procesa hojas de examen escaneadas extrayendo marcas con niveles de confianza calibrados.
2. La interfaz de revisión visual resalta marcas dudosas y permite corrección manual ágil con atajos de teclado.
3. El sistema consolida calificaciones parciales y finales emitiendo el acta respectiva.
4. Los tests de flujo OMR y módulos de calificación se ejecutan en verde.
5. La generación de un examen permite cargar su detalle desde `/api/examenes/generados/:id` y el panel OMR completa el ciclo `/api/omr/jobs` → resolución opcional → finalización.
6. Un job OMR de otro docente no puede consultarse, modificarse ni finalizarse.
7. Las capturas PDF e imagen producen páginas procesadas o errores explícitos y trazables.
8. Una respuesta sin campo de confianza no aparece como 0%; una respuesta con confianza 0 sí aparece como 0% y permanece en revisión.
9. El promedio de confianza solo considera mediciones numéricas disponibles; cuando ninguna existe se muestra “Sin dato”.
10. Una página legible y completamente clasificada puede autocalificarse con blancos, marcas ambiguas, dobles o tachadas; cada una de esas respuestas aporta cero puntos. La ausencia de estado, cobertura o calidad suficiente sigue bloqueando la autocalificación.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Análisis y normalización OMR | `apps/frontend/tests/omrWorkflowState.hooks.test.tsx` | Completado |
| REQ-002 | Interfaz interactiva de calificación OMR | `apps/frontend/tests/seccionCalificar.test.tsx` | Completado |
| REQ-003 | Prioridad y resolución OMR en backend | `apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts` | Completado |
| REQ-004 | Contrato web de detalle y job OMR | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Completado |
| REQ-005 | Persistencia, aislamiento y finalización de jobs | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Completado |
| REQ-006 | Capturas imagen/PDF y errores visibles | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Completado |
| REQ-007 | Confianza histórica ausente vs. confianza real cero | `apps/frontend/tests/escaneo.refactor.test.tsx`, `apps/frontend/tests/utilidades.appDocente.test.ts` | Implementado; 76 pruebas focales frontend PASS; CI de candidata pendiente |
| REQ-008 | Marcas ambiguas/inválidas como incorrectas y guardas por página ilegible | `apps/backend/tests/omr.politicaAutoCalificacion.test.ts`, `apps/backend/tests/omr.estado-respuesta.test.ts` | Implementado; pruebas OMR focales PASS; CI de candidata pendiente |
