---
id: SPEC-124
titulo: Mejora UX y accesibilidad del Installer Hub
version: 1.0.0
fecha: 2026-10-21
autor: Codex
modulo: modulo_installer_windows
estado: approved
---

## Contexto

El asistente WPF del Installer Hub ya guía instalación, reparación, actualización y desinstalación. La solicitud actual pide mejorar significativamente su GUI con buenas prácticas UX/UI. La pantalla usa superficies translúcidas sobre fondos decorativos, controles compactos y algunos símbolos Unicode en lugares interactivos o informativos; esto aumenta ruido visual y hace menos predecible el contraste y el uso con teclado o lector de pantalla.

## Requisitos Funcionales

- REQ-001: Simplificar el fondo y usar superficies opacas con tokens de color semánticos para conservar legibilidad independiente del fondo de escritorio, blur o composición DWM.
- REQ-002: Reforzar jerarquía y espaciado, usar un tamaño inicial de 1200×840 DIP y conservar el mínimo contractual de 980×700 DIP; mantener los controles interactivos con un área mínima de 40×40 DIP.
- REQ-003: Hacer visibles los estados de foco de teclado en botones, campos y selectores, y dar nombre accesible descriptivo a los controles de navegación representados solo por un icono.
- REQ-004: Exponer cambios de estado, etapa activa y siguiente acción como avisos accesibles discretos sin cambiar las transiciones del flujo.
- REQ-005: Sustituir emoji usados como iconos por geometría vectorial accesible y preservar el texto informativo adyacente.
- REQ-006: Conservar acciones, términos, destinos, datos, contratos Burn/MSI, automatización y comportamiento de install/repair/update/uninstall.
- REQ-007: El Hub abre directamente en Términos, sin portada ni carruseles. El encabezado identifica el producto y resume instalar, actualizar, reparar y desinstalar; no repite información del paso activo.

## Criterios de Aceptación

- La ventana y tarjetas usan fondos opacos de respaldo; texto principal/secundario conserva contraste legible y la interfaz ya no depende de patrones decorativos ni del backdrop del sistema.
- Los botones principales/secundarios, navegación por icono, checks y selectores tienen objetivo mínimo de 40 DIP y foco distinguible.
- Los controles de navegación por icono tienen nombre y ayuda accesibles; los cambios de estado y siguiente paso se anuncian mediante UI Automation.
- La GUI compilada conserva nombres/IDs observados por el E2E, el layout de cinco etapas, inicia en 1200×840 DIP, conserva el mínimo de 980×700 DIP y mantiene los mismos flujos y términos.
- La pantalla inicial presenta Términos directamente, conserva el encabezado compacto y destina el espacio liberado a leer las condiciones y sus aceptaciones.
- El contrato de UI y build nativo pasan; se inspeccionan capturas actuales y teclado en runtime cuando el entorno permite abrir el Hub.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-005 | Superficies, área de interacción, iconografía y preservación del layout | `scripts/tests/installer-hub-contract.test.mjs`; capturas WPF 980×700 | Verificado por build y contrato |
| REQ-003, REQ-004 | Foco, nombres accesibles y anuncios de estado UIA | `scripts/tests/installer-hub-contract.test.mjs`; `scripts/tests/installer-hub-ui-lifecycle.ps1` | Verificado por contrato; UIA runtime pendiente |
| REQ-006 | Contratos de operación y preservación del flujo | `scripts/tests/installer-hub-lifecycle-contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | Parcial: instalación QA completada; repair/uninstall pendientes |
| REQ-007 | Entrada directa y reducción de contenido repetido | `scripts/tests/installer-hub-contract.test.mjs`; captura WPF del paso Términos | Verificado |

## Evidencia de Validación

- Build Release Burn/MSI v1.2.9 del 2026-10-22: bundle sin firma local; contenedor y hashes verificados.
- Contratos Installer Hub: 165 pass, 0 fail; lifecycle: 31/31 pass.
- La instalación aislada docente-local reportó `Estado completado`, `Operación nativa completada` y hashes presentes para los cuatro archivos críticos. La E2E terminó como fallida porque no pudo traer la ventana al primer plano para capturar el paso Resultado; no se validaron repair ni uninstall.
- Windows Sandbox mostró `0x80370106` y cerró inesperadamente después de esa captura fallida. El host no registró instalación QA ni cambios en la aplicación instalada.
- El smoke UI no destructivo del host no encontró la ventana WPF esperada y abortó en `wait-window`, antes de iniciar acciones de producto.

## Riesgos y Decisiones

- El refresh se limita al Bootstrapper WPF. No altera aceptación legal, seguridad, logs, payload, datos de usuario ni operación de instalación.
- La validación visual requiere un entorno Windows donde la ventana WPF y Windows UI Automation puedan iniciarse. Si Sandbox o el host no la exponen, se reporta esa limitación y no se atribuye conformidad runtime.
