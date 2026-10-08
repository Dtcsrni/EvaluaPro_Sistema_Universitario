---
id: SPEC-SECURITY-BOUNDARIES
titulo: Endurecimiento de límites de seguridad en contenido, archivos y comandos
version: 1.0.0
fecha: 2026-10-08
autor: Codex / Agente IA
modulo: seguridad
estado: approved
---

# Endurecimiento de límites de seguridad

## Contexto

La revisión de CodeQL identificó rutas donde contenido HTML, nombres de archivo,
orígenes web y argumentos de comandos podían interpretarse con reglas distintas
entre capas. El sistema debe aplicar una política conservadora en los puntos de
entrada y conservar las funciones docentes requeridas.

## Requisitos Funcionales

- **REQ-001:** El contenido rico del banco conserva solo formato docente permitido y marcadores LaTeX con un único valor citado; etiquetas rechazadas no dejan cierres huérfanos.
- **REQ-002:** El editor web sin `DOMParser` escapa el contenido completo antes de insertarlo.
- **REQ-003:** Las rutas de archivos OMR se obtienen de archivos temporales creados por el almacenamiento del servidor; la autorización sobre la ruta debe sobrevivir la copia de metadatos que hace Multer al insertar archivos en `req.files`, y el cliente no puede seleccionar rutas locales.
- **REQ-004:** CORS admite solo orígenes HTTP(S) configurados como coincidencias exactas y rechaza esquemas, hosts y puertos diferentes.
- **REQ-005:** La decodificación de entidades del PDF ocurre una sola vez antes de aplicar la sanitización correspondiente.
- **REQ-006:** Los comandos PowerShell/VS Code serializan cada argumento de forma segura y los selectores CSS usan identificadores escapados.
- **REQ-007:** La E2E del release draft valida el SHA fuente exacto porque el tag todavía no existe; la validación del release público continúa probando el tag publicado y su asset descargable.

## Criterios de Aceptación

- **AC-001:** Pruebas backend confirman el formato permitido, rechazo de atributos y etiquetas, atributos LaTeX inválidos/duplicados y balance de etiquetas.
- **AC-002:** Pruebas frontend confirman saneamiento DOM y escape integral del fallback sin `DOMParser`.
- **AC-003:** Pruebas de archivos OMR confirman aislamiento del path de entrada controlado por cliente, conservación de la ruta generada al copiar metadatos y limpieza de archivos cargados al abortar.
- **AC-004:** Pruebas CORS cubren origen permitido exacto y rechazan orígenes no HTTP(S), host alterno y puerto alterno.
- **AC-005:** Pruebas del renderer PDF cubren entidades codificadas y prevención de doble decodificación.
- **AC-006:** Pruebas de serialización de comandos y workflow comprueban argumentos seguros, selector estable y checkout por SHA en draft; el E2E público conserva el checkout por tag.
- **AC-007:** CI ejecuta lint, typecheck, pruebas de módulo, CodeQL y el gate Windows del instalador antes de integrar y publicar.

## Matriz de Trazabilidad

| Requisito | Pruebas vinculadas | Estado |
| --- | --- | --- |
| REQ-001 | `apps/backend/tests/sanitizarContenidoRico.test.ts` | Implementado; CI pendiente |
| REQ-002 | `apps/frontend/tests/richTextEditor.test.ts` | Implementado; CI pendiente |
| REQ-003 | `apps/backend/tests/archivoTemporalOmr.test.ts` | Implementado; CI pendiente |
| REQ-004 | `apps/backend/tests/app.cors.test.ts`; `apps/backend/tests/configuracion.produccion.test.ts` | Implementado; CI pendiente |
| REQ-005 | `apps/backend/tests/pdfKitRenderer.security.test.ts` | Implementado; CI pendiente |
| REQ-006 | `scripts/tests/vscode-prune-extensions.security.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | Implementado; CI pendiente |
| REQ-007 | `scripts/tests/ci-workflow-contract.test.mjs`; gate `Installer Windows (MSI + Bundle)` | Implementado; CI pendiente |
