---
id: SPEC-058
titulo: Política WCAG 2.2 AA y guardrail permanente de accesibilidad
version: 1.0.0
fecha: 2026-09-15
autor: EvaluaPro Team
modulo: frontend_accesibilidad
estado: approved
---

## Contexto

La interfaz usa superficies glass, temas claro/oscuro y estados dinámicos. Una captura
aislada no garantiza que los elementos nuevos conserven contraste, foco, semántica y
operación con teclado. Se requiere una política única y un gate ejecutable para que la
accesibilidad no dependa de memoria del desarrollador.

## Requisitos Funcionales

- REQ-001: El repositorio debe publicar la política WCAG-UI-POLICY: 2.2-AA para cada
  elemento visible, textual, interactivo o informativo nuevo o modificado.
- REQ-002: Texto normal debe alcanzar 4.5:1, texto grande 3:1 y componentes no
  textuales/indicadores 3:1 en los temas y estados aplicables.
- REQ-003: ESLint debe aplicar plugin:jsx-a11y/recommended al frontend.
- REQ-004: El gate WCAG debe ejecutar la auditoría de contraste, validar el contrato de
  accesibilidad y rechazar nuevos colores CSS sin evidencia WCAG AA.
- REQ-005: El gate debe estar conectado al build docente y al CI frontend.
- REQ-006: La documentación debe distinguir verificación automática de revisión manual
  de teclado, zoom, reflow, lector de pantalla y contenido dinámico.

## Criterios de Aceptación

- AC-001: npm run guard:wcag termina con exit 0 en el estado aprobado.
- AC-002: node scripts/tests/ui-contrast-audit.mjs mantiene todos sus pares por encima
  de los mínimos declarados.
- AC-003: Un CSS con una línea nueva de color crudo fuera de un bloque WCAG AA provoca
  fallo del guard.
- AC-004: El contrato del frontend contiene jsx-a11y, :focus-visible,
  prefers-reduced-motion y la política versionada.
- AC-005: El workflow frontend ejecuta el gate antes del build.
- AC-006: La política declara que los guardrails no sustituyen pruebas manuales de
  lector de pantalla, teclado, zoom, reflow y revisión runtime en claro/oscuro.

## Matriz de Trazabilidad

| Requisito | Descripción | Archivo de Test Vinculado | Estado |
| --- | --- | --- |
| REQ-001, REQ-006 | docs/WCAG_UI_POLICY.md | scripts/tests/wcag-guard.contract.test.mjs | Completado |
| REQ-002 | scripts/tests/ui-contrast-audit.mjs | scripts/tests/ui-contrast-audit.mjs | Completado |
| REQ-003, REQ-004 | apps/frontend/eslint.config.mjs y scripts/wcag-guard.mjs | scripts/tests/wcag-guard.contract.test.mjs | Completado |
| REQ-005 | apps/frontend/package.json y .github/workflows/ci-frontend.yml | scripts/tests/wcag-guard.contract.test.mjs | Completado |

## Fuera de alcance

Este cambio no certifica por sí solo conformidad WCAG completa ni sustituye pruebas con
tecnologías de asistencia y usuarios. Esas validaciones siguen siendo obligatorias para
las rutas modificadas.
