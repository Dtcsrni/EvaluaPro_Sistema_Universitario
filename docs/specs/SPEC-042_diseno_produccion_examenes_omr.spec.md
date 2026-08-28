---
id: SPEC-042
titulo: Estudio de Diseño de Exámenes y Producción Masiva con Folios Únicos
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_diseno_examenes
estado: implemented
---

## Contexto
Maquetación de la estructura del examen por temas y producción masiva de paquetes PDF con folios únicos, códigos QR institucionales y hojas de burbujas OMR.

## Requisitos Funcionales
- **REQ-001 (Maquetación OMR)**: Configuración de materia, temas y estimación de reactivos.
- **REQ-002 (Generación Masiva)**: Creación de lotes con folios y códigos QR individuales por alumno.
- **REQ-003 (Custodia e Historial)**: Descarga de ZIP/PDF, regeneración y trazabilidad forense.

## Criterios de Aceptación
1. El asistente de diseño permite seleccionar materias, temas y distribución de preguntas para el examen.
2. La generación masiva produce folios únicos y códigos QR diferenciados por alumno con barra de progreso interactiva.
3. El historial de lotes mantiene la custodia y permite la descarga de paquetes ZIP/PDF generados.
4. Las pruebas de generación masiva y maquetación de plantillas quedan validadas.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Formulario de diseño y catálogo de plantillas | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-002 | Producción masiva con barra de progreso | `apps/frontend/tests/plantillasGenerados.test.tsx` | Completado |
| REQ-003 | Regeneración e historial de lotes | `apps/backend/tests/controladorListadoGenerados.regenerar.test.ts` | Completado |
