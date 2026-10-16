---
id: SPEC-105
titulo: Descarga pública confiable del PDF de encuadre
version: 1.0.0
fecha: 2026-10-15
autor: Codex
modulo: modulo_evaluaciones
estado: approved
---

## Contexto

La descarga pública del PDF de encuadre comprobaba el archivo con `fs.access()` y luego lo volvía a abrir mediante `res.sendFile()`. El archivo puede desaparecer o cambiar entre ambas operaciones. La ruta debe leer el archivo una sola vez y responder con esos mismos bytes para evitar la carrera; los errores no deben revelar rutas locales.

## Requisitos Funcionales

- REQ-001: validar token, firma, ruta permitida y existencia del PDF.
- REQ-002: leer el PDF una sola vez antes de iniciar la respuesta y enviar exactamente el buffer leído.
- REQ-003: responder `404` si el archivo no existe y `500` con mensaje genérico ante fallos de lectura inesperados.
- REQ-004: conservar respuestas `400` para rutas rechazadas y `200` con `Content-Type: application/pdf` para descargas válidas.

## Criterios de Aceptación

- La descarga válida entrega bytes PDF no vacíos y ejecuta una sola lectura del archivo.
- Un archivo inexistente devuelve `404` sin iniciar una descarga parcial.
- Un error de lectura inesperado devuelve un error genérico sin exponer ruta, stack ni mensaje del sistema operativo.
- Las pruebas de integración del encuadre pasan.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Token/ruta válidos e inválidos conservan su contrato | `apps/backend/tests/integracion/encuadre.modulo.test.ts` | Aprobado |
| REQ-002 | Descarga válida reutiliza una sola lectura | `apps/backend/tests/integracion/encuadre.modulo.test.ts` | Aprobado |
| REQ-003 | Archivo ausente y error inesperado se responden con seguridad | `apps/backend/tests/integracion/encuadre.modulo.test.ts` | Aprobado |
| REQ-004 | Respuesta PDF válida conserva tipo de contenido | `apps/backend/tests/integracion/encuadre.modulo.test.ts` | Aprobado |
