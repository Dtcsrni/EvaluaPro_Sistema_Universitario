---
id: SPEC-151
titulo: Lista de reactivos incorrectos en resultados de examen
version: 1.0.0
fecha: 2026-11-23
autor: Codex / solicitud docente
modulo: modulo_calificacion
estado: approved
---

# SPEC-151: Lista de reactivos incorrectos en resultados de examen

## Contexto
El docente necesita transcribir al examen escrito una retroalimentación breve que permita al alumno estudiar los reactivos fallados. La pantalla de revisión ya dispone de la clave y respuestas detectadas OMR por número de pregunta; la UI mostrará únicamente la lista compacta de números, sin alterar el cálculo ni guardar una calificación distinta.

## Requisitos Funcionales
- **REQ-001:** Cuando el resultado OMR tenga clave completa y detalle de respuesta para todos los reactivos, mostrar junto al resultado `Incorrectas: n, n, ...`; incluir respuestas sin marca, ambiguas o inválidas como incorrectas según la clave usada por el motor.
- **REQ-002:** Si no hay reactivos incorrectos, mostrar `Incorrectas: ninguna`.
- **REQ-003:** No inferir números incorrectos para una captura que solo contiene el total de aciertos ni para resultados persistidos sin detalle completo por reactivo.
- **REQ-004:** La lista es solo informativa; no cambia nota, respuestas persistidas ni flujo de autorización.

## Criterios de Aceptación
- **AC-001 (REQ-001):** Con una respuesta correcta, una respuesta distinta a la clave y una respuesta nula/ambigua, la GUI muestra los números incorrectos ordenados por número.
- **AC-002 (REQ-002):** Con todas las respuestas iguales a la clave, la GUI muestra `Incorrectas: ninguna`.
- **AC-003 (REQ-003):** La captura manual por total de aciertos no muestra la lista.
- **AC-004 (REQ-004):** Las pruebas confirman que el payload de calificación y el cálculo no cambian.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Muestra reactivos erróneos, sin marca y ambiguos en orden | `apps/frontend/tests/seccionCalificar.test.tsx` | Completado |
| REQ-002 | Muestra estado sin errores | `apps/frontend/tests/seccionCalificar.test.tsx` | Completado |
| REQ-003 | Oculta lista cuando solo hay total manual o falta detalle | `apps/frontend/tests/seccionCalificar.test.tsx` | Completado |
| REQ-004 | Verifica cálculo/payload inalterados | `apps/frontend/tests/seccionCalificar.test.tsx` | Completado |
