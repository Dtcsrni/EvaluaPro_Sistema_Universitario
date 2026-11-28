---
id: SPEC-065
titulo: Ciclo de vida de servicios locales del App Host
version: 1.2.3
fecha: 2026-11-25
autor: Erick Vega / Codex
modulo: app-host
estado: approved
---

## Contexto
EvaluaPro puede reutilizar servicios locales ya activos durante el arranque. El App Host no registraba como propio el dashboard reutilizado y, por ello, su cierre no detenía el backend y la interfaz web. Al elegir «Sí» para salir, los servicios propios se detienen ordenadamente; al elegir «No», la ventana pasa a la bandeja y el App Host conserva las APIs disponibles para el panel lateral.

Una instancia del App Host también puede quedar viva después de perder su ventana. El mutex singleton bloquea entonces nuevas ejecuciones y el usuario observa que EvaluaPro no abre, aunque la aplicación no tenga una ventana utilizable.

El diálogo de cierre distingue entre detener los servicios locales y cerrar solo la ventana, dejando el runtime identificado activo para que una nueva instancia pueda adoptarlo. La segunda opción no debe volver a invocar el cierre de la ventana dentro del evento WPF `Closing` que todavía está activo. «No: mantener servicios en segundo plano» es la opción predeterminada; detener los servicios requiere una selección explícita de «Sí».

El arranque frío de la API docente puede ejecutar comprobaciones OMR y preparar SQLite antes de responder salud. Un límite demasiado corto deja una ventana nativa en error aunque los servicios terminen sanos inmediatamente después.

## Requisitos Funcionales
- REQ-001: Antes de declarar listos servicios web/API preexistentes, el host identifica el dashboard mediante su `/api/status`, y adopta su proceso solo si la raíz y el puerto coinciden con la instalación y el lock file local.
- REQ-002: El host inicia el dashboard cuando no existe uno válido y conserva una referencia al proceso que controla el ciclo de vida.
- REQ-003: Al elegir «Sí» para detener EvaluaPro o «Salir» desde la bandeja, el host termina el árbol del dashboard controlado, deteniendo también el supervisor y backend/web descendientes.
- REQ-004: El host no termina procesos Node ajenos ni servicios que no pudo identificar como propios.
- REQ-005: Si web/API responden pero el host no puede identificar el dashboard propio, no declara lista la aplicación ni reutiliza esos servicios independientes.
- REQ-006: Si el mutex singleton está ocupado por el mismo ejecutable y sesión, pero la instancia no tiene ventana después de una gracia mínima de arranque, el host recupera únicamente ese árbol y reintenta adquirir el mutex; una instancia válida se enfoca y una ruta de instalación distinta no se termina.
- REQ-007: El host espera los servicios web y API durante un límite finito de 60 segundos en arranque frío; solo declara lista la aplicación cuando ambos responden correctamente y registra un diagnóstico si vence el límite.
- REQ-008: Al elegir «No», el host difiere los cambios de visibilidad hasta que terminen el evento WPF `Closing` y el diálogo modal, oculta la ventana y mantiene el App Host, la bandeja y las APIs sanas; no muestra una excepción ni fuerza el cierre.
- REQ-009: En la confirmación de cierre, «No: mantener servicios en segundo plano» es el botón predeterminado; la acción que detiene API e interfaz no se activa por una aceptación predeterminada del diálogo.

## Criterios de Aceptación
- Si web/API ya responden desde el dashboard de la instalación, el host registra el proceso antes del retorno de éxito.
- Si las identidades de raíz, puerto o PID no coinciden, el host no adopta ni mata ese proceso.
- Si web/API responden sin un dashboard identificable, el inicio se considera fallido en vez de dejar la aplicación conectada a servicios autónomos.
- Al elegir «Sí» o «Salir», el host termina el árbol del proceso que inició o adoptó.
- Las pruebas de contrato detectan una regresión en la ruta temprana de servicios sanos y en el cierre del árbol.
- Una segunda ejecución recupera una instancia huérfana sin ventana solo cuando coincide el ejecutable, la sesión y la antigüedad mínima; no termina una instalación distinta ni una instancia aún en arranque.
- Un arranque frío que requiere hasta 60 segundos no queda en error prematuro, pero un servicio que no responde después del límite sí produce diagnóstico y error visible.
- El E2E de Windows elige «No», verifica que el App Host permanezca residente y oculto sin registrar excepciones, que API/web sigan sanos, restaura la ventana desde la bandeja y después verifica el cierre normal de los servicios.
- Al invocar el diálogo de cierre, la opción predeterminada es «No»; «Sí» sigue disponible para detener explícitamente los servicios.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Adopción validada ocurre antes del retorno por health existente | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-002 | El proceso iniciado queda registrado para su cierre | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-003 | Salir explícito termina el árbol del proceso controlado | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-004 | Identidad no válida no se adopta ni se termina | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-005 | Servicios sanos sin propietario identificado no se reutilizan | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-006 | El singleton recupera solo un App Host huérfano y reintenta la adquisición | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-007 | El arranque frío usa un timeout finito de 60 s y exige salud web/API | `scripts/tests/app-host-health.contract.test.mjs` | Completado |
| REQ-008 | «No» difiere la ocultación, conserva bandeja y APIs, y evita excepciones WPF | `scripts/tests/app-host-shutdown.contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | Implementado; E2E Windows previo detectó fallo, falta validar el fix |
| REQ-009 | «No» es la opción predeterminada y detener requiere elección explícita | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
