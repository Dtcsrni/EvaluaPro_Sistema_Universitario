---
id: SPEC-050_host_nativo_escritorio
titulo: Shell Nativo de Escritorio EvaluaPro.exe (.NET 8 + WebView2)
version: 1.0.0
fecha: 2026-08-31
autor: Antigravity / Agente IA
modulo: devops
estado: implemented
---

# SPEC-050: Shell Nativo de Escritorio EvaluaPro.exe (.NET 8 + WebView2)

## Contexto
EvaluaPro requería una experiencia de usuario 100% nativa en Windows que eliminara cualquier dependencia visual o funcional de navegadores web externos (`msedge.exe`, `chrome.exe`) y scripts intermediarios `.vbs`. Los requisitos clave abordan:
1. Iniciar la aplicación en una ventana nativa de escritorio independiente en menos de 200 ms.
2. Contener un *Splash Screen* nativo acelerado por hardware (DirectX/WPF) con animación de carga mientras se inicializan los servicios locales de Node y SQLite.
3. Incrustar el control Microsoft Edge WebView2 sin barra de direcciones, sin menús contextuales de navegador ni marcas de terceros.
4. Gestionar el ciclo de vida del backend: arrancar los servicios en segundo plano y terminarlos limpiamente al cerrar la ventana para prevenir puertos o procesos huérfanos.
5. Crear accesos directos de Windows que apunten directamente a `EvaluaPro.exe`.

## Requisitos Funcionales
- **REQ-001:** El proyecto `packaging/app-host/EvaluaPro.AppHost.csproj` debe compilar como ejecutable nativo WinExe en .NET 8 (`net8.0-windows`, `win-x64`) produciendo el binario `EvaluaPro.exe`.
- **REQ-002:** `MainWindow.xaml` debe proveer una ventana moderna de escritorio con tema oscuro Nordic Slate, barra de título personalizada y un *Splash Screen* nativo en WPF mientras los servicios locales se activan.
- **REQ-003:** El control `WebView2` debe inicializarse con el perfil de usuario aislado bajo `%LOCALAPPDATA%\EvaluaPro\webview2-profile`, suprimiendo la barra de estado y herramientas de desarrollo a menos que `EVALUAPRO_DEBUG=1`.
- **REQ-004:** `MainWindow.xaml.cs` debe verificar la disponibilidad de los servicios locales (`http://127.0.0.1:4173/`) antes de transicionar la vista con un efecto suave de desvanecimiento (*fade-in*).
- **REQ-005:** Al cerrar la ventana (`Closing`), `EvaluaPro.exe` debe terminar de forma limpia y forzosa todos los subprocesos de Node.js creados en la sesión.
- **REQ-006:** `scripts/create-shortcuts.ps1` debe priorizar `EvaluaPro.exe` como destino principal del acceso directo del Escritorio (`EvaluaPro.lnk`), eliminando llamadas a `wscript.exe` cuando el binario nativo está disponible.
- **REQ-007:** `packaging/wix/BurnBootstrapperApp/EvaluaProBootstrapperApplication.cs` debe invocar directamente `EvaluaPro.exe` al presionar el botón "Iniciar EvaluaPro" en la pantalla de resultado final.
- **REQ-008:** `scripts/build-msi.ps1` debe publicar e incluir `EvaluaPro.exe` en el staging del instalador MSI docente.

## Criterios de Aceptación
- **AC-001 (REQ-001, REQ-002):** `EvaluaPro.exe` compila sin errores en .NET 8 y levanta una ventana de escritorio nativa independiente.
- **AC-002 (REQ-003, REQ-004):** La interfaz web se renderiza embebida dentro de `EvaluaPro.exe` sin cromo de navegador ni redirecciones externas.
- **AC-003 (REQ-005):** Cerrar la ventana principal no deja procesos zombi en los puertos 4000, 4173 ni 4519.
- **AC-004 (REQ-006):** El acceso directo `EvaluaPro.lnk` apunta al ejecutable `EvaluaPro.exe`.
- **AC-005 (REQ-007, REQ-008):** El instalador WiX y el Hub enlazan la ejecución nativa de `EvaluaPro.exe`.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Compilación y presencia de `EvaluaPro.AppHost.csproj` | `scripts/tests/installer-hub-contract.test.mjs` | implemented |
| REQ-002 | Definición de ventana y splash nativo en `MainWindow.xaml` | `scripts/tests/installer-hub-contract.test.mjs` | implemented |
| REQ-003 | Configuración y aislamiento de WebView2 | `scripts/tests/installer-hub-contract.test.mjs` | implemented |
| REQ-004 | Verificación de puerto antes de navegación | `scripts/tests/installer-hub-contract.test.mjs` | implemented |
| REQ-005 | Limpieza de subprocesos en cierre de ventana | `scripts/tests/installer-hub-contract.test.mjs` | implemented |
| REQ-006 | Creación de acceso directo hacia `EvaluaPro.exe` | `scripts/tests/installer-hub-contract.test.mjs` | implemented |
| REQ-007 | Lanzamiento de `EvaluaPro.exe` desde Bootstrapper Hub | `scripts/tests/installer-hub-contract.test.mjs` | implemented |
| REQ-008 | Empaquetado de `EvaluaPro.exe` en staging de `build-msi.ps1` | `scripts/tests/installer-hub-contract.test.mjs` | implemented |
