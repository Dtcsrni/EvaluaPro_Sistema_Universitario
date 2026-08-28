---
id: SPEC-001
titulo: Gobernanza de Spec-Driven Development (SDD)
version: 1.0.0
fecha: 2026-06-23
autor: Antigravity
modulo: devops
estado: implemented
---

# SPEC-001: Gobernanza de Spec-Driven Development (SDD)

## Contexto
Para garantizar que todos los desarrollos sigan el enfoque Spec-Driven Development de forma estricta y que las especificaciones no se conviertan en "documentación obsoleta", necesitamos un auditor automatizado. Este script validará que todas las especificaciones markdown en `docs/specs/` cumplan con la plantilla, contengan las secciones requeridas, y que los archivos de pruebas listados en su matriz de trazabilidad existan físicamente en el repositorio.

## Requisitos Funcionales
- **REQ-001:** El script `sdd-audit.mjs` debe leer recursivamente todos los archivos `*.spec.md` dentro de `docs/specs/` (excepto la plantilla `template.spec.md`).
- **REQ-002:** Para cada spec procesada, el script debe validar la presencia y el tipo de los campos del YAML frontmatter (`id`, `titulo`, `version`, `fecha`, `autor`, `modulo`, `estado`).
- **REQ-003:** El script debe validar la presencia obligatoria de los encabezados `## Contexto`, `## Requisitos Funcionales`, `## Criterios de Aceptación` y `## Matriz de Trazabilidad`.
- **REQ-004:** El script debe parsear la matriz de trazabilidad y extraer todas las rutas de archivos de tests declaradas.
- **REQ-005:** Para cada archivo de test extraído, el script debe verificar si existe en el sistema de archivos relativo a la raíz del repositorio. Si un archivo no existe, debe reportar un error y retornar exit code 1.

## Criterios de Aceptación
- **AC-001 (REQ-002):** Validar que falle si el frontmatter está ausente o si falta algún campo requerido.
- **AC-002 (REQ-003):** Validar que falle si no encuentra los encabezados markdown requeridos.
- **AC-003 (REQ-005):** Validar que falle si un archivo de test en la tabla de trazabilidad es inexistente, y que pase si todos los archivos de tests existen.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Leer y escanear especificaciones excluyendo la plantilla | `scripts/tests/sdd-audit.test.mjs` | Completado |
| REQ-002 | Validar campos requeridos en el frontmatter YAML | `scripts/tests/sdd-audit.test.mjs` | Completado |
| REQ-003 | Validar presencia de secciones obligatorias markdown | `scripts/tests/sdd-audit.test.mjs` | Completado |
| REQ-004 | Parsear rutas de archivos de pruebas desde la matriz | `scripts/tests/sdd-audit.test.mjs` | Completado |
| REQ-005 | Verificar existencia real de archivos en disco | `scripts/tests/sdd-audit.test.mjs` | Completado |
