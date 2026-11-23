---
id: SPEC-147
titulo: Instantáneas locales cifradas en streaming
version: 1.0.0
fecha: 2026-10-23
autor: Codex
modulo: modulo_sincronizacion_nube
estado: approved
---

## Contexto

La exportación actual serializa la base SQLite completa y sus artefactos en memoria y limita el archivo a 45 MiB. Una instalación docente con una base mayor no puede crear la copia de seguridad requerida para un traslado local. El flujo v2 debe procesar el contenido incrementalmente, mantenerlo cifrado y autenticado, conservar compatibilidad de lectura con v1 y evitar que navegador y backend dupliquen el archivo en memoria.

## Requisitos Funcionales

- **REQ-001:** Exportar una copia SQLite coherente y los artefactos asociados en un contenedor v2 comprimido y cifrado AES-256-GCM, escribiendo por streaming con máximo 2 GiB y hasta 500 artefactos.
- **REQ-002:** Importar v2 mediante archivo temporal y streaming, verificar autenticidad, propietario, rutas, tamaños, hashes e integridad SQLite antes de ofrecer o aplicar el reemplazo.
- **REQ-003:** Mantener lectura de instantáneas v1 existentes dentro del límite legado de 65 MiB.
- **REQ-004:** Recibir y enviar los bytes del contenedor sin construir una copia concatenada del archivo completo en backend o frontend; limpiar temporales en éxito, error y desconexión.
- **REQ-005:** Rechazar archivos truncados, alterados, sobredimensionados y manifiestos inválidos sin modificar la instalación.

## Criterios de Aceptación

- CA-001: Una exportación de prueba superior a 65 MiB se escribe como v2 sin usar un Buffer del tamaño completo y puede validarse en modo dry-run.
- CA-002: El round-trip preserva SQLite y artefactos, y los checksums por archivo coinciden.
- CA-003: Alteración o truncamiento del contenedor se rechaza antes de cualquier reemplazo.
- CA-004: Los contenedores v1 continúan usando el lector legado acotado a 65 MiB.
- CA-005: El endpoint HTTP y el navegador envían el contenedor como stream/blob sin concatenarlo en un `Uint8Array` del tamaño total.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-005 | Exportación/importación v2, autenticidad e integridad | `apps/backend/tests/sincronizacion.snapshot.test.ts` | Pendiente de validación |
| REQ-003 | Compatibilidad de contenedores legados | `apps/backend/tests/sincronizacion.snapshot.test.ts` | Pendiente de validación |
| REQ-004 | Recepción streaming y limpieza de temporales | `apps/backend/tests/sincronizacion.snapshot.test.ts` | Pendiente de validación |
