---
id: SPEC-INSTALLER-HUB-LAYOUT
titulo: Modernizacion y Rediseno Integral del Layout del Installer Hub
version: 1.1.2
fecha: 2026-08-24
autor: Codex / Antigravity AI
modulo: modulo_installer_windows
estado: implemented
---

# SPEC-INSTALLER-HUB-LAYOUT: Modernizacion y Rediseno Integral del Layout del Installer Hub

## Contexto
El Installer Hub nativo para Windows proporciona una experiencia guiada de 5 etapas para instalar, reparar, actualizar y desinstalar EvaluaPro en entornos docentes con alta densidad de información y escalado DPI.

## Requisitos Funcionales
- REQ-001: Todas las tarjetas internas deben utilizar fondos translúcidos oscuros de vidrio y paleta de alto contraste.
- REQ-002: Ningún paso del asistente debe forzar barras de desplazamiento vertical internas en resoluciones estándar o con escalado DPI de laptop.
- REQ-003: La pantalla de "Preparar operación" debe organizarse en una cuadrícula compacta de dos columnas equilibradas.
- REQ-004: El carrusel de funciones del encabezado debe ser compacto y optimizado verticalmente para maximizar el área de trabajo útil.
- REQ-005: La interfaz debe incorporar transiciones suaves de opacidad y animaciones de interacción.
- REQ-006: El paso de revisión debe mostrar la verificación del hardware real del usuario (SO, CPU, RAM, espacio libre en disco) y confirmar la naturaleza 100% offline del paquete.
- REQ-007: El asistente debe calcular dinámicamente una estimación adaptativa del tiempo de instalación según los recursos del equipo.
- REQ-008: La pantalla de bienvenida (Paso 1) debe tener un diseño minimalista sin saturación visual, destacando el logotipo de EvaluaPro de forma prominente y ocultando tarjetas de diagnóstico previas al inicio.
- REQ-009: La navegación entre los pasos del asistente debe reproducir una transición suave de Fade + Slide Up con curva de desaceleración cúbica en 250ms.
- REQ-010: El texto del paso de bienvenida y términos debe utilizar formato tipográfico enriquecido (negritas, cursivas, subrayados y color), tamaño de fuente aumentado y logotipo único en la cabecera sin duplicados.

## Criterios de Aceptación
- La UI luce consistente con el tema Glassmorphic y textos con contraste nítido (`#FFFFFF`, `#DCE7F5`).
- No se genera desbordamiento vertical en el paso de Preparar ni en el de Revisar.
- El resumen refleja el hardware real y la ruta seleccionada por el usuario.
- La pantalla de bienvenida presenta jerarquía tipográfica enriquecida con tamaño legible (13.5px / 14px) y sin logotipo duplicado.
- La navegación entre pantallas ejecuta transiciones suaves sin parpadeos.
- Pruebas de contrato de layout pasan al 100%.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Fondos translúcidos de vidrio y alto contraste | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-002 | Cero desbordamiento vertical en laptops | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-003 | Cuadrícula de 2 columnas en preparación | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-004 | Carrusel compacto de funciones | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-005 | Transiciones suaves de interacción | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-006 | Verificación de hardware real del equipo | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-007 | Estimación adaptativa de tiempo | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-008 | Pantalla de bienvenida minimalista | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-009 | Transiciones fluidas entre etapas | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-010 | Jerarquía tipográfica y accesibilidad | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |

