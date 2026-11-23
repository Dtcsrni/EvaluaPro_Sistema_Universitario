---
id: SPEC-150
titulo: Bandeja nativa e inicio automatico para EvaluaPro docente-local
version: 1.0.0
fecha: 2026-11-03
autor: Codex
modulo: app-host-windows
estado: approved
---

## Contexto

En docente-local, el host WPF inicia el dashboard y la API, pero cerrar su ventana detiene el stack. El launcher de dashboard intenta crear un icono ejecutando `launcher-tray.ps1`, aunque el payload nativo excluye scripts PowerShell. Se requiere mantener la sesión local disponible con una bandeja nativa, conservar el cierre explícito de servicios y arrancar en la siguiente sesión de Windows.

Diseño aprobado por el usuario: iniciar con Windows, minimizar al cerrar, detener servicios únicamente con «Salir» y verificar el payload de instalación. La solución debe cumplir SPEC-094: no iniciar PowerShell ni Windows Script Host desde docente-local; usar el host .NET existente y un acceso directo de inicio por usuario.

## Requisitos Funcionales

- REQ-001: `EvaluaPro.exe --tray-start` inicia el host docente-local y deja la ventana oculta después de que API y web estén listas; los errores de arranque mantienen visible la pantalla de diagnóstico.
- REQ-002: El host crea un `NotifyIcon` nativo con acciones «Abrir EvaluaPro» y «Salir». Doble clic y «Abrir EvaluaPro» restauran la ventana y su estado.
- REQ-003: Cerrar la ventana principal oculta la ventana y mantiene activos el host, dashboard, API y web. No solicita ni ejecuta shutdown en este camino.
- REQ-004: «Salir» es la única acción de bandeja que solicita el cierre ordenado de los servicios que el host inició o verificó como propios; luego dispone el icono y cierra el host.
- REQ-005: La reconciliación nativa crea y verifica un acceso directo por usuario en `Environment.SpecialFolder.Startup`, dirigido al ejecutable canónico con argumento `--tray-start`; la reconciliación es idempotente y no altera los accesos directos existentes.
- REQ-006: El host nativo deshabilita el autoinicio del tray PowerShell en el dashboard. docente-local no depende de `launcher-tray.ps1`, `.vbs`, `powershell.exe`, `pwsh.exe` ni `wscript.exe` para la bandeja o el inicio automático.
- REQ-007: No se agrega servicio Windows, dependencia de runtime, privilegio elevado ni cambio de datos. La bandeja se ejecuta en la sesión interactiva del usuario.
- REQ-008: En `docente-local`, una solicitud web a la raíz del supervisor redirige a la Web Docente, excepto cuando `EVALUAPRO_DEBUG=1`. Las rutas `/api/*` del supervisor permanecen disponibles para el host nativo y el panel lateral.
- REQ-009: La salud del perfil `docente-local` no sondea ni muestra MongoDB. Las verificaciones de los servicios requeridos se ejecutan concurrentemente. Los perfiles que declaran explícitamente runtime Docker conservan su comprobación de MongoDB.
- REQ-010: `EvaluaPro.exe --shutdown` envía una orden unidireccional de cierre al App Host de la misma ruta, usuario y sesión mediante una tubería local limitada al usuario actual. El cliente devuelve el resultado del envío; el E2E verifica por separado que el host y su árbol Node terminen dentro del timeout.

## Criterios de Aceptación

1. El inicio normal muestra la ventana; el argumento `--tray-start` la oculta solo después de que web/API respondan listas.
2. Cerrar por la X cancela el cierre, retira la ventana de la barra de tareas y mantiene saludables API/web; abrir desde el icono restaura la ventana.
3. Elegir «Salir» cierra el stack de la instancia identificada, elimina el icono y termina el host. Una instancia ajena no se detiene.
4. El acceso de inicio automático apunta al `EvaluaPro.exe` instalado, contiene `--tray-start`, se puede recrear sin duplicados y no ejecuta scripts.
5. Build nativo de Windows y pruebas de contrato verifican el ciclo de vida y la ausencia de dependencia en el script heredado.
6. Se conservan iconos, acceso a Installer Hub y reconciliación de shortcuts existentes.
7. Abrir directamente el puerto del supervisor en `docente-local` redirige a la Web Docente; modo debug conserva la pantalla administrativa y `/api/status` responde para el host.
8. En `docente-local` la respuesta de salud omite `mongoLocal`; el perfil Docker mantiene esa verificación. Las comprobaciones independientes se inician en paralelo.
9. La orden `--shutdown` cierra desde bandeja sin interacción gráfica, conserva los servicios si la identidad del host no coincide y el E2E verifica la terminación del host y su árbol Node.

## Matriz de Trazabilidad

| Requisito | Prueba | Estado |
| --- | --- | --- |
| REQ-001..REQ-004 | `scripts/tests/app-host-tray-lifecycle.contract.test.mjs` + build Windows del AppHost | Implementado; build y 6 contratos pasan |
| REQ-005 | Contrato de ShortcutReconciler en `scripts/tests/app-host-tray-lifecycle.contract.test.mjs` | Implementado; contrato pasa |
| REQ-006..REQ-007 | Contrato de runtime nativo y empaquetado | Implementado; build local pasa; MSI no publicado |
| REQ-008..REQ-009 | `scripts/tests/dashboard-native-health.contract.test.mjs`, `scripts/tests/dashboard-repair.test.mjs` | Implementado; 4 contratos enfocados y E2E local del supervisor pasan |
| REQ-010 | `scripts/tests/app-host-shutdown.contract.test.mjs` + `scripts/tests/installer-hub-e2e-docente.ps1` | Contrato local actualizado; requiere E2E real Windows para verificar la terminación |

## Riesgos y decisión

- Mantener API y WebView2 en bandeja consume memoria persistente; el cierre explícito desde «Salir» libera esos procesos.
- Se selecciona `NotifyIcon` de Windows Forms, ya habilitado en el AppHost .NET, dentro del proceso WPF existente. Esto evita un servicio, un segundo daemon y la ejecución de PowerShell.
- El acceso de inicio automático es por usuario actual y queda visible en la carpeta Inicio de Windows para que el usuario pueda deshabilitarlo desde Windows.
