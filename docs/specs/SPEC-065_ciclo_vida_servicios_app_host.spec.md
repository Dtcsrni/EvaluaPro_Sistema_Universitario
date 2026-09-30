---
id: SPEC-065
titulo: Ciclo de vida de servicios locales del App Host
version: 1.2.0
fecha: 2026-09-25
autor: Erick Vega / Codex
modulo: app-host
estado: approved
---

## Contexto
EvaluaPro puede reutilizar servicios locales ya activos durante el arranque. El App Host no registraba como propio el dashboard reutilizado y, por ello, su cierre no detenía el backend y la interfaz web. Los servicios de la instalación docente deben permanecer activos solo mientras la ventana de EvaluaPro está abierta.

Una instancia del App Host también puede quedar viva después de perder su ventana. El mutex singleton bloquea entonces nuevas ejecuciones y el usuario observa que EvaluaPro no abre, aunque la aplicación no tenga una ventana utilizable.

El arranque frío de la API docente puede ejecutar comprobaciones OMR y preparar SQLite antes de responder salud. Un límite demasiado corto deja una ventana nativa en error aunque los servicios terminen sanos inmediatamente después.

## Requisitos Funcionales
- REQ-001: Antes de declarar listos servicios web/API preexistentes, el host identifica el dashboard mediante su `/api/status`, y adopta su proceso solo si la raíz y el puerto coinciden con la instalación y el lock file local.
- REQ-002: El host inicia el dashboard cuando no existe uno válido y conserva una referencia al proceso que controla el ciclo de vida.
- REQ-003: Al cerrar la ventana, el host termina el árbol del dashboard controlado, deteniendo también el supervisor y backend/web descendientes.
- REQ-004: El host no termina procesos Node ajenos ni servicios que no pudo identificar como propios.
- REQ-005: Si web/API responden pero el host no puede identificar el dashboard propio, no declara lista la aplicación ni reutiliza esos servicios independientes.
- REQ-006: Si el mutex singleton está ocupado por el mismo ejecutable y sesión, pero la instancia no tiene ventana después de una gracia mínima de arranque, el host recupera únicamente ese árbol y reintenta adquirir el mutex; una instancia válida se enfoca y una ruta de instalación distinta no se termina.
- REQ-007: El host espera los servicios web y API durante un límite finito de 60 segundos en arranque frío; solo declara lista la aplicación cuando ambos responden correctamente y registra un diagnóstico si vence el límite.

## Criterios de Aceptación
- Si web/API ya responden desde el dashboard de la instalación, el host registra el proceso antes del retorno de éxito.
- Si las identidades de raíz, puerto o PID no coinciden, el host no adopta ni mata ese proceso.
- Si web/API responden sin un dashboard identificable, el inicio se considera fallido en vez de dejar la aplicación conectada a servicios autónomos.
- Al cerrar, el host termina el árbol del proceso que inició o adoptó.
- Las pruebas de contrato detectan una regresión en la ruta temprana de servicios sanos y en el cierre del árbol.
- Una segunda ejecución recupera una instancia huérfana sin ventana solo cuando coincide el ejecutable, la sesión y la antigüedad mínima; no termina una instalación distinta ni una instancia aún en arranque.
- Un arranque frío que requiere hasta 60 segundos no queda en error prematuro, pero un servicio que no responde después del límite sí produce diagnóstico y error visible.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Adopción validada ocurre antes del retorno por health existente | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-002 | El proceso iniciado queda registrado para su cierre | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-003 | Cierre termina el árbol del proceso controlado | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-004 | Identidad no válida no se adopta ni se termina | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-005 | Servicios sanos sin propietario identificado no se reutilizan | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-006 | El singleton recupera solo un App Host huérfano y reintenta la adquisición | `scripts/tests/app-host-shutdown.contract.test.mjs` | Completado |
| REQ-007 | El arranque frío usa un timeout finito de 60 s y exige salud web/API | `scripts/tests/app-host-health.contract.test.mjs` | Completado |
