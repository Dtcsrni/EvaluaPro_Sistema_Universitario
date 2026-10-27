---
id: SPEC-091
titulo: Deteccion y actualizacion segura desde la aplicacion y Installer Hub
version: 1.3.0
fecha: 2026-10-27
autor: Codex
modulo: modulo_actualizacion_instalador
estado: approved
---

## Contexto

El flujo vigente comprueba actualizaciones desde el launcher/dashboard local. El docente usa la aplicacion y el Installer Hub, por lo que puede no ver ese aviso. La aplicacion debe mostrar un banner discreto al detectar una release estable compatible; el Hub debe permitir continuar el flujo desde una version anterior. Descargar o instalar nunca debe ocurrir sin una accion informada del usuario.

La actualizacion debe seguir funcionando sin Classroom, portal, dashboard visible ni credenciales de sincronizacion remota. Debe conservar los datos docentes locales y recuperarse si falla el reemplazo, el reinicio de servicios o la comprobacion de salud.

## Requisitos Funcionales

- REQ-001: Al abrir la aplicacion instalada, consultar de forma asincrona la version estable publicada y mostrar un banner discreto solo si existe una version superior compatible para el mismo flavor. No mostrar betas en el canal estable, no degradar, ocultar el banner cuando la instalacion ya este al dia y no bloquear el uso normal mientras se consulta.
- REQ-002: El banner debe indicar version disponible y ofrecer acciones accesibles para ver novedades, iniciar descarga, posponer y abrir el flujo de actualizacion. No descargar ni aplicar en segundo plano sin una accion del docente.
- REQ-003: Desde una instalacion existente, la aplicacion debe iniciar por el AppHost una comprobacion estable del Hub y pedir confirmacion antes de descargar. Al resolver un Hub local, el AppHost debe examinar todos los candidatos del manifiesto, del registro de Windows y del directorio de actualizaciones verificadas; debe omitir rutas inexistentes o que no superen firma/hash y continuar hasta encontrar un candidato confiable, sin que una ruta obsoleta bloquee candidatos válidos posteriores. Si se abre el Hub descargado, este debe ejecutar la actualizacion guiada de la instalacion detectada. Un Hub ya abierto no puede reemplazarse a si mismo en ejecucion; debe delegar al nuevo instalador y cerrar o esperar de forma controlada.
- REQ-004: Antes de aplicar, volver a resolver la release para evitar ejecutar una version retirada o sustituida; exigir tag/asset/version compatibles, hash SHA-256 valido y firma Authenticode valida del editor esperado. Fallos de red, metadatos, hash o firma deben bloquear la ejecucion y dejar un mensaje recuperable.
- REQ-005: La actualizacion no depende de dashboard visible ni de sincronizacion cloud. Crear y verificar un respaldo local coherente de los datos antes de detener servicios; migraciones de datos deben ser compatibles con rollback o documentar una ruta de recuperacion verificada.
- REQ-006: Detener servicios de esta instalacion de forma fail-closed: si no se puede enumerar/detener el proceso propio, no reemplazar payload. Aplicar el payload con transaccion recuperable; ante fallo, restaurar el payload previo, reanudar los servicios que estaban activos y comprobar salud. Informar claramente cuando la recuperacion no pueda completarse.
- REQ-007: Mantener el servicio de actualizacion local restringido a loopback y conservar autorizacion reforzada para aplicar. La UI no puede convertir el endpoint de actualizacion en una ruta remota ni incluir secretos en mensajes o logs.
- REQ-008: Añadir validacion automatizada para releases stable/beta, versiones iguales y menores, assets ausentes, errores de red, confirmacion, descarga/hash/firma, cancelacion, fallos en stop/install/start/health, rollback y preservacion de datos. Cubrir el banner con pruebas de interfaz y el ciclo Windows con smoke/E2E de actualizacion entre versiones.

## Criterios de Aceptación

1. Con canal estable y una release estable compatible superior, la aplicacion muestra el banner sin bloquear su inicio; beta, draft, asset incorrecto, version igual o inferior no lo muestran.
2. El docente puede posponer el aviso y seguir usando la aplicacion; solo una confirmacion explicita permite iniciar la instalacion.
3. La descarga se verifica contra SHA-256 y firma Authenticode antes de ejecutarse; un fallo no altera la instalacion ni los datos locales.
4. La actualizacion funciona con el dashboard no visible y sin token de sincronizacion, mantiene los datos, y valida servicios despues de instalar.
5. Cada fallo inyectado durante detencion, promocion, arranque o salud termina en rollback verificable o en estado degradado accionable, sin declarar exito ni dejar procesos parcialmente activos silenciosamente.
6. El Hub en ejecucion no reemplaza sus propios archivos; delega en el instalador descargado tras confirmacion y reporta el resultado.
7. La release estable solo se publica despues de generar el instalador para el SHA candidato, pasar CI/QA y el gate de promocion versionado.
8. Si un manifiesto o entrada de registro apunta a un ejecutable antiguo sin confianza y existe un Hub descargado cuyo hash coincide con un registro oficial local, el App Host omite el archivo antiguo y puede abrir el Hub verificado; si no existe candidato confiable, falla de forma visible y no ejecuta ninguno.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Seleccion de version estable compatible y aviso al iniciar app | `apps/frontend/tests/updateAvailabilityBanner.test.tsx` | Implementado |
| REQ-002 | Acciones del banner, posponer y consentimiento para instalar | `apps/frontend/tests/updateAvailabilityBanner.test.tsx` | Implementado |
| REQ-003 | AppHost descarga el bundle estable confirmado, delega al nuevo Hub y omite rutas locales inexistentes/no confiables | `scripts/tests/installer-hub-architecture.contract.test.mjs`; `scripts/tests/app-host-shutdown.contract.test.mjs` | En validación CI |
| REQ-004 | Validacion de release, hash, firma y bloqueo de activos invalidos | `scripts/tests/installer-hub-architecture.contract.test.mjs` | Implementado |
| REQ-005 | Preflight local sin dependencia de sincronizacion remota | `scripts/tests/update-manager.test.mjs` | Pendiente de ampliar |
| REQ-006 | Fail-closed, rollback, reinicio y salud post-update | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Pendiente de ampliar |
| REQ-007 | Restriccion local y autorizacion de aplicacion | `scripts/tests/update-api.test.mjs` | Pendiente de ampliar |
| REQ-008 | Casos de regresion y transiciones de actualizacion | `scripts/tests/update-manager.test.mjs` | Pendiente de ampliar |

## Decisiones y limites

- Alcance inicial: instalacion `docente-local` en Windows y canal `stable`.
- No se implementa instalacion silenciosa ni actualizacion forzada.
- La aplicacion informa; el Hub ejecuta el instalador. No se introduce un segundo mecanismo independiente de reemplazo de archivos.
- El Hub debe verificar la firma del instalador descargado con una identidad de editor configurada/versionada; una suma SHA-256 por si sola detecta corrupcion, pero no autentica el origen.
- La sustitución de PowerShell/WSH por un launcher nativo para abrir el Hub se especifica en SPEC-094; esta spec conserva el contrato de confirmación, firma, hash y delegación al Burn.
