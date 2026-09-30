---
id: SPEC-067
titulo: Compatibilidad del payload de previsualización Classroom
version: 1.0.0
fecha: 2026-09-28
autor: No especificado
modulo: modulo_integraciones_classroom
estado: draft
---

# Compatibilidad del payload de previsualización Classroom

## Estado

Implementación local en revisión.

## Contexto

El frontend de Classroom envía incluirEnPromedio al previsualizar o ejecutar la importación. El esquema Zod estricto del backend rechazaba ese campo y detenía la operación con Payload invalido.

## Requisitos Funcionales

- El payload de cada actividad puede incluir incluirEnPromedio como booleano opcional.
- Valores de otro tipo deben rechazarse.
- El esquema debe seguir rechazando propiedades desconocidas.
- El mismo contrato se aplica a preview y ejecución.

## Criterios de Aceptación

- Payloads BI y DAW con incluirEnPromedio: true se validan.
- El valor no booleano se rechaza con ruta de issue actividades.0.incluirEnPromedio.
- Los campos desconocidos siguen rechazados.
- La vista previa real muestra la actividad, sus entregas y notas antes de permitir la sincronización.

## Matriz de Trazabilidad

| Caso | Validación | Test vinculado |
|---|---|---|
| BI / preview y ejecución con flag booleano | Prueba unitaria del esquema | `apps/backend/tests/validacionesClassroom.test.ts` |
| DAW / preview y ejecución con flag booleano | Prueba unitaria del esquema | `apps/backend/tests/validacionesClassroom.test.ts` |
| Flag con tipo inválido | Issue apunta al campo | `apps/backend/tests/validacionesClassroom.test.ts` |
| Campo desconocido | Se conserva modo estricto | `apps/backend/tests/validacionesClassroom.test.ts` |
| Fuente Google Classroom real | Preview visible en UI antes de guardar | `apps/frontend/tests/seccionClassroom.test.tsx` |
| Escritura de evidencias | Solo después de revisar la previsualización | `apps/backend/tests/integracion/classroom.v2.test.ts` |

## Límites

La prueba del esquema no demuestra conectividad OAuth, lectura de Classroom ni escritura de calificaciones. Esos pasos requieren previsualización y lectura posterior de las evidencias guardadas.
