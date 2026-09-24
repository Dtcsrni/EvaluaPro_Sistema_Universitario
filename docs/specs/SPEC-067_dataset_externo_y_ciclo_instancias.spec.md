---
id: SPEC-067
titulo: Dataset OMR externo y ciclo de vida de instancias EvaluaPro
version: 1.0.0
fecha: 2026-09-24
autor: Codex / Agente IA
modulo: release_installer_dataset
estado: approved
---

## Contexto

EvaluaPro necesita conservar capturas OMR reales sin introducirlas en el ejecutable docente, extraer únicamente metadatos disponibles, vincular etiquetas de evaluación con procedencia verificable y mantener un ciclo de vida seguro para el Installer Hub y sus sabores funcionales. La evidencia disponible puede ser exportada por CamScanner y carecer de EXIF de la cámara física; el sistema debe representar esa ausencia sin inferir fabricante, modelo, lente, GPS o parámetros fotográficos.

## Requisitos Funcionales

- REQ-001: El preparador externo debe leer imágenes sin modificarlas y generar un manifiesto con SHA-256, tamaño, tipo, dimensiones, perfil ICC y estado de metadatos EXIF.
- REQ-002: El preparador debe generar etiquetas JSONL vinculadas por `captureId` y hash, conservando la procedencia del reporte OMR y marcando duplicados byte a byte.
- REQ-003: El paquete externo debe usar un contenedor sin pérdida y una lista de hashes verificable; no debe agregarse al payload del ejecutable docente.
- REQ-004: El Hub debe modelar `docente-local` y `saas-completo` como sabores con identidad, datos y prerequisitos separados; no debe declarar side-by-side seguro si comparten raíz de instalación, datos o puertos.
- REQ-005: El Hub debe distinguir instalación actual, legacy, repairable, orphaned y local-ahead-of-official; una release remota inferior nunca debe provocar downgrade automático.
- REQ-006: Reparación, actualización, rollback y desinstalación deben preservar datos por defecto, exigir confirmación para limpieza total y dejar trazabilidad operativa.

## Criterios de Aceptación

- AC-001: Un dataset de 38 JPEG reales produce manifiesto, etiquetas, hashes y archivo comprimido; los hashes de las imágenes recuperadas coinciden con los originales.
- AC-002: La ausencia de EXIF se informa explícitamente y no se convierte en una identidad de cámara inventada.
- AC-003: La captura duplicada se conserva para trazabilidad, pero se marca como no única y no incrementa el conteo de páginas únicas.
- AC-004: Los contratos del Hub documentan una instancia de Hub por equipo, una instancia productiva `docente-local` por raíz de datos y una instancia institucional `saas-completo` con prerequisitos Docker/portal.
- AC-005: Las pruebas de update manager cubren canal stable, release remota inferior y verificación de SHA-256; los contratos del Hub cubren el ciclo y la exclusión side-by-side insegura.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Inventario lossless y ausencia de EXIF | `scripts/tests/omr-camera-dataset.test.mjs` | Implementado |
| REQ-002 | Etiquetado por hash y duplicados | `scripts/tests/omr-camera-dataset.test.mjs` | Implementado |
| REQ-003 | ZIP sin pérdida fuera del payload | `scripts/tests/omr-camera-dataset.test.mjs` | Implementado |
| REQ-004 | Identidad y exclusión de sabores | `scripts/tests/installer-instance-lifecycle.test.mjs` | Implementado |
| REQ-005 | No downgrade y estados de instalación | `scripts/tests/update-manager.test.mjs` | Implementado |
| REQ-006 | Reparación y retiro preservando datos | `scripts/tests/installer-instance-lifecycle.test.mjs` | Implementado |
