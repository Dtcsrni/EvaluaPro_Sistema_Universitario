---
id: SPEC-073
titulo: Portada de materia por API y GUI
version: 1.0.0
fecha: 2026-09-30
autor: Codex / Agente IA
modulo: modulo_alumnos_periodos
estado: approved
---

# SPEC-073: Portada de materia por API y GUI

## Contexto

La tarjeta de materia solo muestra un icono genérico y el recurso Periodo no admite imagen. El docente necesita asignar una portada local a cada materia desde la GUI y administrar la misma imagen mediante el API autenticado. Cuando no haya portada, la tarjeta conserva su icono genérico. La imagen no debe inflar las respuestas normales de listado ni depender de una URL externa o de una ruta local del servidor.

## Requisitos Funcionales

- **REQ-001:** El API permite consultar, reemplazar/subir y retirar una portada de un Periodo existente: `GET` y `PUT /periodos/:periodoId/portada`, `DELETE /periodos/:periodoId/portada`. La carga usa multipart con un único campo `archivo`; usa permisos de lectura/gestión del periodo y aislamiento por docente.
- **REQ-002:** La portada acepta los formatos rasterizados comunes JPG/JPEG, PNG y WebP; limita la carga a 20 MiB y 20 megapíxeles, valida el contenido real del archivo y normaliza la imagen a WebP de hasta 1600×1200, sin metadatos EXIF. SVG, GIF y formatos no incluidos se rechazan.
- **REQ-003:** Los bytes normalizados se guardan en SQLite en una entidad dependiente del Periodo; sobreviven reinicios/actualizaciones y se eliminan en cascada con el Periodo. El listado de periodos expone solo si hay portada, nunca los bytes.
- **REQ-004:** La GUI permite seleccionar una imagen local, previsualizarla antes de guardar y administrarla después. Si no hay imagen o la carga falla, muestra el icono genérico; si falla la carga después de crear la materia, informa que la materia sí se creó y permite reintentar la portada.
- **REQ-005:** La tarjeta de materia muestra la portada cuando existe, conserva el nombre/grupo como contenido accesible y funciona por teclado, con fallback genérico y diseño responsive.
- **REQ-006:** Se documentan los endpoints HTTP, permisos, campo multipart, límites y respuestas; las pruebas cubren carga válida, rechazos, autorización/aislamiento, retiro, persistencia, lista sin bytes y GUI con/fuera de portada.

## Criterios de Aceptación

- **AC-001 (REQ-001):** Docente autorizado puede cargar, leer y reemplazar portada; otro docente no puede leerla ni modificarla. Retirarla es idempotente y deja el fallback.
- **AC-002 (REQ-002):** Archivos no imagen, MIME falso, SVG, GIF, archivo mayor a 20 MiB y dimensiones mayores a 20 megapíxeles reciben error 4xx sin persistir datos; la respuesta de lectura declara `image/webp` para la versión normalizada.
- **AC-003 (REQ-003):** Reiniciar la conexión conserva portada; `GET /periodos` no devuelve los bytes; borrar periodo elimina la portada dependiente sin tabla paralela fuera de SQLite.
- **AC-004 (REQ-004):** GUI muestra previsualización y confirmación de guardado/reemplazo; un fallo de carga conserva el estado parcial visible y permite reintento sin duplicar materia.
- **AC-005 (REQ-005):** Sin imagen o con error de lectura se ve el icono genérico; con imagen se ve el recorte sin ocultar título ni navegación; controles tienen nombre accesible, foco visible y operación por teclado.
- **AC-006 (REQ-006):** Tests API y frontend verifican los requisitos y límites; `npm run routes:check`, `npm run sdd:audit`, `npm run guard:wcag` y las comprobaciones aplicables de `lint`, `typecheck` y tests pasan.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Validación de imagen, permisos, aislamiento, carga/lectura/reemplazo/retiro | `apps/backend/tests/integracion/periodosPortada.test.ts`; `scripts/api/check-openapi-contract.mjs` | API 5/5; OpenAPI y contrato verificados |
| REQ-003 | Persistencia SQLite, cascada y listado sin bytes | `apps/backend/tests/integracion/periodosPortada.test.ts` | Cascada, listado sin BLOB y tabla aditiva verificados |
| REQ-004, REQ-005 | Selección, previsualización, fallback y acceso por teclado | `apps/frontend/tests/seccionPeriodos.portada.test.tsx`; `npm run guard:wcag -- --skip-lint` | GUI 3/3; guard WCAG 20/20 |
| REQ-006 | Contrato HTTP, permisos, límites, documentación API y gates | `apps/backend/tests/integracion/periodosPortada.test.ts` | API/GUI focal, typecheck, builds, lint, routes y SDD verificados; release global no evaluada |
