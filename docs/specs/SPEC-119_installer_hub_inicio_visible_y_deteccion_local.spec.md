---
id: SPEC-119
titulo: Inicio visible y diagnóstico local del Installer Hub
version: 1.0.0
fecha: 2026-10-18
autor: Codex
modulo: installer_hub
estado: approved
---

## Contexto

> Integrada como componente de release en [SPEC-122](SPEC-122_estabilizacion_release_1_2_8.spec.md); esta ficha conserva la aprobación y el origen del requisito.

La primera repetición del E2E con el bundle `docente-local` 1.2.8 confirmó un defecto del harness: Burn muestra `WixBurnMessageWindow` en el PID raíz y aloja la GUI `EvaluaPro Installer Hub` en el proceso hijo `EvaluaPro.BurnBootstrapperApp.exe`. El runner filtraba únicamente por el PID raíz y expiró a los 45 s. El log de esa corrida registró `UI Loaded` y el inicio de `detect-prereqs`, pero no su finalización antes de terminar el harness; el helper y el render necesitan validación tras corregir la asociación de proceso. En una ejecución anterior la captura quedó blanca y el cierre reportó `E_HANDLE`; esa evidencia permanece como antecedente que debe volver a comprobarse.

La corrección debe hacer que las pruebas locales separen el fallo del harness, el arranque del bootstrapper, el handoff al helper y el render visible. Debe terminar con diagnóstico accionable y no reportar una pantalla aprobada si está en blanco o no representa el estado esperado.

## Requisitos Funcionales

- **REQ-001:** El E2E local debe seguir el proceso y la ventana pertenecientes al bundle que acaba de iniciar, sin confundir ventanas de otros procesos ni depender de una búsqueda global ambigua.
- **REQ-002:** La espera de ventana y detección debe usar límites que respeten los timeouts documentados del bootstrapper y guardar la etapa exacta, tiempos, PID, estado del proceso y logs disponibles cuando falle.
- **REQ-003:** Antes de aprobar una captura, el E2E debe validar imagen no vacía/no monocroma, ventana visible, controles UI Automation esperados y estado accesible esperado; una ventana blanca debe fallar con reporte legible.
- **REQ-004:** Investigar y corregir el fallo reproducible en el arranque local del helper/detección o demostrar con evidencia que el retraso proviene del harness. No ocultar fallos con retries que conviertan una ejecución inestable en verde.
- **REQ-005:** El cierre de una instancia creada por el test debe ser controlado y limitado a su proceso/árbol propio; el cierre normal no debe generar una excepción no controlada ni un diálogo crítico.
- **REQ-006:** Añadir regresiones para ventana que tarda en aparecer, helper que no completa, captura blanca y cierre de ventana durante la detección, con salida local fail-closed y evidencia conservada.
- **REQ-007:** Ejecutar la validación del Installer Hub localmente dos veces consecutivas en el mismo bundle candidato y exigir dos reportes aprobados con capturas visuales legibles antes de solicitar CI/CD.

## Criterios de Aceptación

- El caso local reproduce un fallo de arranque/detección y emite etapa, PID y artefactos diagnósticos sin terminar como aprobado.
- Con el defecto corregido, dos corridas consecutivas del mismo bundle completan la detección y producen capturas actuales no blancas que muestran el estado y la acción esperados.
- El proceso propio termina de forma limpia y no deja procesos huérfanos ni excepciones de cierre.
- El set local de regresión pasa sin retries ocultos, skips nuevos ni incremento de timeout ajeno al SLA comprobado.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003, REQ-006 | Identidad de ventana/proceso, timeout, estado UIA y captura no blanca | `scripts/tests/installer-hub-ui-lifecycle.ps1`; `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Verificado localmente en dos pasadas: 9 capturas por pasada, 0 resultados fallidos, modos y estado final observables, viewport 980×700, panel técnico plegado y capturas no blancas. El estado de expansión se lee del `ExpandCollapsePattern`, que es el proveedor UIA correcto. La pantalla se captura pasivamente y falla cerrada ante oclusión |
| REQ-004, REQ-005 | Handoff de detección, diagnóstico y cierre controlado | `scripts/tests/installer-hub-contract.test.mjs`; `scripts/tests/installer-hub-lifecycle-contract.test.mjs`; `scripts/tests/installer-hub-ui-lifecycle.ps1` | `npm run qa:full` pasó sus 9 gates; contrato Hub 155/167 con 12 skips previstos; lifecycle 26/26. Cada reporte visual concluye con `processState=exited`, `failedCount=0` y etapa `finalize-report`. La implementación y validación local están completas; falta CI del SHA final |
| REQ-007 | Dos pasadas visuales locales sobre el mismo bundle | `scripts/tests/installer-hub-ui-lifecycle.ps1` | Cumplido en dos corridas consecutivas con SHA-256 `B71957A4C7B4EF0F4F83205DF9EA4E24E62F9343C4D6103C1AB99C5E0E413955`. Evidencia externa al checkout: `%TEMP%\EvaluaPro\qa-1.2.8-local\installer-hub-ui\pass-A` y `pass-B`; ambos reportes `passed`, 9 capturas, 0 fallos y proceso cerrado |
