---
id: SPEC-REDISENIO-INTEGRAL-GUI
titulo: Rediseño Integral GUI, Paletas de Lujo, Wireframes Maestros y Glassmorphism
version: 1.1.1
fecha: 2026-08-23
autor: Antigravity / DeepMind AI
modulo: frontend_gui_unificada
estado: implemented
---

# SPEC-REDISENIO-INTEGRAL-GUI: Rediseño Integral GUI, Paletas de Lujo, Wireframes Maestros y Glassmorphism

## Contexto
Modernizar la interfaz gráfica completa de EvaluaPro (Docente, Alumno y Admin Negocio) bajo el sistema de diseño **Prismatic Sapphire & Glassmorphism**, migrando de una disposición monolítica a una arquitectura de navegación moderna (**Glass Dock + Topbar Ejecutiva**), con paleta de color de alto contraste, superficies translúcidas con `backdrop-filter: blur(20px)`, reflejos especulares interiores y paneles de trabajo ergonómicos.

## Requisitos Funcionales
- **REQ-GUI-001 (Paleta de Colores Prismatic Sapphire)**:
  - Fondo: `#060B14` (oscuro) / `#F8FAFC` (claro)
  - Superficies de cristal: `rgba(15, 29, 54, 0.78)` y `rgba(23, 42, 77, 0.70)`
  - Acento Primario: Gradiente Cobalto Eléctrico ➔ Cian Neón (`#2563EB` ➔ `#00D2FF`)
  - Acentos de Datos: `#00D2FF` (Cian), `#A78BFA` (Violeta), `#FBBF24` (Ámbar)
- **REQ-GUI-002 (Navegación y Layout)**:
  - Dock de navegación Glassmorphic con accesibilidad ARIA completa.
  - Topbar con selector de ciclo, buscador y chip de perfil de usuario.
  - Vistas divididas (*Split-pane*) para flujos de diseño de exámenes y calificación OMR.
- **REQ-GUI-003 (Microinteracciones y Contratos)**:
  - Cumplimiento de `scripts/tests/gui-design-contract.test.mjs` (radios contenidos <= 22px o píldoras 999px, sin tracking negativo ni radiales no autorizados).
  - Preservación de todos los roles, landmarks y nombres accesibles probados en suites E2E y unitarias.

## Criterios de Aceptación
1. `npm run test:gui:design-contract` pasa al 100%.
2. `npm run lint` y `npm run typecheck` reportan 0 errores.
3. `npm run test:frontend:ci` pasa al 100% (200/200 pruebas).
4. `npm run test:gui:responsive:e2e:ci` pasa al 100% en todas las resoluciones (`desktop-lg`, `tablet`, `tablet-sm`, `mobile`).
5. Generación de evidencias visuales completas en `reports/qa/latest/`.

## Matriz de Trazabilidad
| ID Requisito | Descripción | Tests Vinculados |
| :--- | :--- | :--- |
| REQ-GUI-001 | Contrato de diseño CSS | `scripts/tests/gui-design-contract.test.mjs` |
| REQ-GUI-002 | Responsividad Playwright E2E | `tests/gui-responsive/responsive-docente.spec.ts` |
| REQ-GUI-003 | Accesibilidad y roles frontend | `apps/frontend/tests/ux.quality.test.tsx` |

