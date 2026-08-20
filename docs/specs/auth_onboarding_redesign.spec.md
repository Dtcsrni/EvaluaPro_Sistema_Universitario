---
id: SPEC-AUTH-ONBOARDING
titulo: Rediseno Integral de Pantalla Inicial y Experiencia de Bienvenida Docente
version: 1.1.1
fecha: 2026-08-20
autor: Codex / Antigravity AI
modulo: modulo_autenticacion
estado: implemented
---

# SPEC-AUTH-ONBOARDING: Rediseno Integral de Pantalla Inicial y Experiencia de Bienvenida Docente

## Contexto
La pantalla inicial de autenticacion y primer uso de EvaluaPro mostraba titulos de navegacion interna (como Banco y Examenes) y paneles con jerga tecnica redundante. Este modulo desacopla la autenticacion del shell interno del dashboard y provee un portal de bienvenida limpio, elegante e intuitivo.

## Requisitos Funcionales
- REQ-001: La pantalla de autenticacion no debe renderizar encabezados de submodulos internos ni metricas de sesion innecesarias.
- REQ-002: El portal de acceso debe mostrar la marca EvaluaPro, propuesta de valor clara y tres pilares funcionales.
- REQ-003: El formulario debe permitir alternar fluidamente entre Iniciar Sesion y Registro / Activacion de Licencia.
- REQ-004: El badge de version debe reflejar la version estable oficial (v1.1.1).
- REQ-005: El lanzador debe invocar exclusivamente la ventana de escritorio dedicada sin abrir pestanas de navegador duplicadas.
- REQ-006: La interfaz del portal de bienvenida debe incluir micro-interacciones fluidas y animaciones CSS escalonadas (staggered fade/scale) accesibles, respetando prefers-reduced-motion.

## Criterios de Aceptación
- La pantalla inicial luce limpia, profesional y sin textos fuera de contexto.
- Micro-animaciones atractivas y fluidas en tarjetas y elementos clave con soporte de accesibilidad.
- Todos los tests de frontend y trazabilidad pasan en verde.

## Matriz de Trazabilidad
| Requisito | Archivo de Test | Estado |
| :--- | :--- | :--- |
| REQ-001 | apps/frontend/tests/seccionAutenticacion.test.tsx | Pasa |
| REQ-002 | apps/frontend/tests/seccionAutenticacion.test.tsx | Pasa |
| REQ-003 | apps/frontend/tests/seccionAutenticacion.test.tsx | Pasa |
| REQ-004 | apps/frontend/tests/seccionAutenticacion.test.tsx | Pasa |
| REQ-005 | scripts/tests/installer-hub-contract.test.mjs | Pasa |
| REQ-006 | apps/frontend/tests/gui.responsive.audit.test.ts | Pasa |
