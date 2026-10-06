---
id: SPEC-074
titulo: Barra docente con identidad y version verificables
version: 1.0.0
fecha: 2026-10-06
autor: Codex / EvaluaPro Team
modulo: frontend_docente
estado: approved
---

# SPEC-074: Barra docente con identidad y versión verificables

## Contexto

La barra docente muestra una etiqueta técnica OMR que no ayuda a la navegación, un monograma en lugar de una imagen predeterminada docente y debe reflejar la versión real integrada en el bundle. Se requiere una barra compacta y coherente que dé prioridad a la identidad y acciones de cuenta, y permita usar una foto si existe en el perfil; si no, el docente puede elegir una imagen guardada solo en el equipo actual.

## Requisitos Funcionales

- **REQ-001:** La barra del shell docente no presenta la etiqueta de contrato OMR; las vistas y herramientas OMR conservan su información técnica.
- **REQ-002:** La versión de la barra se obtiene del valor técnico del build `VITE_APP_VERSION` mediante `obtenerVersionTecnicaApp()`; no se mantienen literales por pantalla.
- **REQ-003:** El avatar prioriza una imagen no vacía devuelta por el perfil de cuenta; si no existe, muestra un icono docente neutral. Un error de carga retorna al icono genérico.
- **REQ-004:** Si el docente inicia sesión con Google, la foto HTTPS de su perfil verificado se conserva vinculada a su cuenta y se entrega en `/autenticacion/perfil`. Al actualizar una base SQLite anterior se añade la columna opcional sin pérdida de datos. Si no existe una foto de cuenta, puede elegir o retirar una imagen local. Se valida tipo PNG/JPEG/WebP y tamaño máximo documentado; la imagen local se guarda por docente en el navegador y no se envía a la API.
- **REQ-005:** La barra ordena visualmente identidad, versión, tema y salida; mantiene nombres accesibles, teclado, foco visible y adaptación responsive.

## Criterios de Aceptación

- **AC-001 (REQ-001):** El shell docente no renderiza el chip OMR y la vista de información OMR continúa disponible.
- **AC-002 (REQ-002):** El valor mostrado procede de `obtenerVersionTecnicaApp()` y un test verifica el valor de build sin una versión hardcodeada en `ShellDocente`.
- **AC-003 (REQ-003):** Se verifica el fallback docente, la prioridad de la foto de cuenta y el fallback tras error de imagen.
- **AC-004 (REQ-004):** Se verifica lectura/escritura/retiro por ID docente y rechazo de tipo/tamaño inválido; la foto local no aparece en solicitudes API.
- **AC-005 (REQ-005):** Se verifica el nombre accesible del botón de cuenta y se ejecutan lint, typecheck y guard WCAG aplicables.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Barra sin chip OMR, versión del helper, avatar neutral, prioridad y fallback de foto | `apps/frontend/tests/appDocente.test.tsx`; `apps/frontend/tests/seccionCuenta.test.tsx` | CI pendiente |
| REQ-004 | Persistencia de foto Google en cuenta/perfil, migración SQLite aditiva y persistencia local por docente | `apps/backend/tests/integracion/autenticacion.googleOnly.test.ts`; `apps/backend/tests/servicioGoogle.test.ts`; `apps/backend/tests/integracion/periodosPortada.test.ts`; `scripts/tests/prepare-docente-sqlite.test.mjs`; `apps/frontend/tests/fotoPerfilDocente.test.ts`; `apps/frontend/tests/seccionCuenta.test.tsx` | CI pendiente |
| REQ-005 | Navegación al perfil desde el botón accesible | `apps/frontend/tests/appDocente.test.tsx` | CI pendiente |
