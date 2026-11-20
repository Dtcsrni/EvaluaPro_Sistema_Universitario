---
id: SPEC-065
titulo: Ciclo de vida de servicios locales del App Host
version: 1.2.3
fecha: 2026-11-20
autor: Erick Vega / Codex
modulo: app-host
estado: approved
---

## Contexto
EvaluaPro puede reutilizar servicios locales ya activos durante el arranque. El App Host no registraba como propio el dashboard reutilizado y, por ello, su cierre no detenía el backend y la interfaz web. Los servicios de la instalación docente deben permanecer activos mientras EvaluaPro esté en uso, ya sea con la ventana visible o en la bandeja.

Una instancia del App Host también puede quedar viva después de perder su ventana. El mutex singleton bloquea entonces nuevas ejecuciones y el usuario observa que EvaluaPro no abre, aunque la aplicación no tenga una ventana utilizable.

El diálogo de cierre distingue entre detener los servicios locales y mantenerlos activos en la bandeja. Al ocultar la ventana, EvaluaPro conserva el proceso propietario para que la API siga disponible al panel lateral y el acceso directo pueda restaurar esa misma instancia. La operación no debe volver a invocar el cierre de la ventana dentro del evento WPF `Closing` que todavía está activo.

El App Host crea un `NotifyIcon` nativo después de validar los servicios. Al elegir «No», oculta su ventana y conserva el mismo proceso, el icono y las API; un nuevo inicio desde el acceso directo restaura esa instancia. Esto evita depender de un proceso PowerShell externo.

El arranque frío de la API docente puede ejecutar comprobaciones OMR y preparar SQLite antes de responder salud. Un límite demasiado corto deja una ventana nativa en error aunque los servicios terminen sanos inmediatamente después.

## Requisitos Funcionales
- REQ-001: Antes de declarar listos servicios web/API preexistentes, el host identifica el dashboard mediante su `/api/status`, y adopta su proceso solo si la raíz y el puerto coinciden con la instalación y el lock file local.
- REQ-002: El host inicia el dashboard cuando no existe uno válido y conserva una referencia al proceso que controla el ciclo de vida.
- REQ-003: Al cerrar la ventana, el host termina el árbol del dashboard controlado, deteniendo también el supervisor y backend/web descendientes.
- REQ-004: El host no termina procesos Node ajenos ni servicios que no pudo identificar como propios.
- REQ-005: Si web/API responden pero el host no puede identificar el dashboard propio, no declara lista la aplicación ni reutiliza esos servicios independientes.
- REQ-006: Si el mutex singleton está ocupado por el mismo ejecutable y sesión, pero la instancia no tiene ventana después de una gracia mínima de arranque, el host recupera únicamente ese árbol y reintenta adquirir el mutex; una instancia válida se enfoca y una ruta de instalación distinta no se termina.
- REQ-007: El host espera los servicios web y API durante un límite finito de 60 segundos en arranque frío; solo declara lista la aplicación cuando ambos responden correctamente y registra un diagnóstico si vence el límite.
- REQ-008: Al elegir «No», el host mantiene cancelado el cierre WPF, oculta solo la ventana y conserva vivos los servicios identificados y el App Host; no invoca `Close()` desde el mismo evento ni muestra una excepción.
- REQ-009: El App Host crea un `NotifyIcon` nativo dentro de su propio proceso tras validar/adoptar servicios sanos. Al elegir «No», oculta la ventana y conserva el App Host, el icono y los servicios; abrir el acceso directo restaura la ventana existente. El E2E verifica el mismo PID y salud web/API.
- REQ-010: La E2E de upgrade mantiene compatibilidad con el baseline oficial 1.2.3: verifica su instalación, apertura y salud web/API sin exigirle la nueva bandeja; después del upgrade, exige `NotifyIcon` vivo dentro del App Host candidato y restaura la misma instancia tras elegir «No».
- REQ-011: El menú nativo de bandeja ofrece reabrir EvaluaPro y cerrar la aplicación con confirmación; cerrar desde la bandeja detiene API/web antes de salir. La implementación no lanza scripts ni procesos auxiliares de PowerShell/WSH.

## Criterios de Aceptación
- Si web/API ya responden desde el dashboard de la instalación, el host registra el proceso antes del retorno de éxito.
- Si las identidades de raíz, puerto o PID no coinciden, el host no adopta ni mata ese proceso.
- Si web/API responden sin un dashboard identificable, el inicio se considera fallido en vez de dejar la aplicación conectada a servicios autónomos.
- Al cerrar, el host termina el árbol del proceso que inició o adoptó.
- Las pruebas de contrato detectan una regresión en la ruta temprana de servicios sanos y en el cierre del árbol.
- Una segunda ejecución recupera una instancia huérfana sin ventana solo cuando coincide el ejecutable, la sesión y la antigüedad mínima; no termina una instalación distinta ni una instancia aún en arranque.
- Un arranque frío que requiere hasta 60 segundos no queda en error prematuro, pero un servicio que no responde después del límite sí produce diagnóstico y error visible.
- El E2E de Windows elige «No», comprueba que la ventana se oculta sin registrar excepciones, que el mismo App Host y la bandeja siguen vivos, restaura esa instancia y después verifica el cierre normal de los servicios.
- El E2E de Windows acredita que el icono de bandeja fue creado por un proceso vivo y que ese mismo proceso permanece activo tras elegir «No»; un registro antiguo no satisface el criterio.
- La E2E de upgrade no aplica requisitos de bandeja introducidos después de su baseline; sí exige el contrato en la candidata actual antes de probar el cierre de solo ventana.
- El icono nativo de bandeja se crea en el proceso App Host y permite restaurar la ventana o cerrar limpiamente; ningún proceso PowerShell/WSH adicional aparece al iniciar, ocultar o restaurar EvaluaPro.

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
| REQ-008 | Ventana oculta con App Host y servicios activos, sin reentrada WPF | `scripts/tests/app-host-shutdown.contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | Implementado; requiere E2E Windows |
| REQ-009 | La bandeja se crea y persiste junto con API/web después de cerrar la ventana | `scripts/tests/app-host-shutdown.contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | Implementado; requiere E2E Windows |
| REQ-010 | El baseline legado verifica salud; la candidata y su restauración conservan la bandeja en el mismo proceso | `scripts/tests/app-host-shutdown.contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | Implementado; requiere E2E Windows |
| REQ-011 | El menú de bandeja restaura y cierra limpiamente el App Host nativo | `scripts/tests/app-host-shutdown.contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | Implementado; requiere E2E Windows |
