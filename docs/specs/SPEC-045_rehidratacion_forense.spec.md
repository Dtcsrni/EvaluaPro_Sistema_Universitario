---
id: SPEC-045
titulo: Rehidratación Forense de Lotes y Trazabilidad de Exámenes Impresos
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_rehidratacion
estado: implemented
---

## Contexto
Capacidad de reconstruir el estado completo de un examen, su clave de respuestas y los datos del estudiante a partir del código QR o folio impreso en caso de contingencias o pérdida de conexión.

## Requisitos Funcionales
- **REQ-001 (Lectura de Folio/QR Forense)**: Decodificación de metadatos criptográficos del examen.
- **REQ-002 (Reconstrucción de Clave)**: Reensamble de la clave original del examen.
- **REQ-003 (Restauración de Evaluación)**: Habilitar la calificación aún sin conexión previa al servidor.

## Criterios de Aceptación
1. A partir del código QR y folio impreso se decodifican los metadatos necesarios para reconstruir la evaluación.
2. El sistema recupera la clave de respuestas original asociada al examen sin depender de base de datos previa.
3. La pantalla de rehidratación permite calificar lotes recuperados en contingencia offline.
4. Los tests de hidratación de cursos y rehidratación de lotes pasan exitosamente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Hidratación de cursos y lotes en backend | `apps/backend/tests/integracion/hidratacionCursos.test.ts` | Completado |
| REQ-002 | Claves forenses y utilidades OMR | `apps/frontend/tests/utilidades.appDocente.test.ts` | Completado |
| REQ-003 | Interfaz de rehidratación de lotes | `apps/frontend/tests/seccionRehidratacionLotes.test.tsx` | Completado |
