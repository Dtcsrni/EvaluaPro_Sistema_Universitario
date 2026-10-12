---
id: SPEC-086
titulo: Identidad de procesos y readiness del App Host
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: modulo_app_host_windows
estado: approved
---

## Contexto

La inspección del flujo de inicio/cierre encontró que el App Host adopta un proceso por PID y respuestas HTTP, pero no compara el ejecutable ni confirma que el PID reportado por el dashboard sea el mismo que aparece en `/api/status`. También devuelve listo si web y API responden durante el segundo sondeo, aunque no tenga un proceso dashboard identificado. En esa rama puede abrirse contra servicios ajenos o dejar servicios huérfanos al cerrar.

La corrección debe mantener recuperación de un dashboard propio ya iniciado, impedir que PID reutilizado o servicios de otro proceso se adopten, y serializar intentos de inicio/reintento para no duplicar instancias.

## Requisitos Funcionales

- REQ-001: La adopción valida que PID y puerto coincidan entre `dashboard.lock.json` y `/api/install` o endpoint equivalente autenticado localmente, que el `root` sea la instalación canónica y que el ejecutable y hora de inicio pertenezcan al runtime/proceso de esa raíz.
- REQ-002: El App Host solo declara lista la ventana cuando web y API responden y conserva un handle de proceso dashboard cuya identidad haya sido verificada o que inició en la operación actual.
- REQ-003: Un PID ausente, reutilizado, un lock obsoleto, un estado con otro root/puerto o una respuesta de otro proceso no se adopta ni se termina; el Host muestra un error accionable.
- REQ-004: Solo existe un intento de arranque/reintento en curso por ventana; una segunda petición no lanza otro supervisor.
- REQ-005: El arranque usa exclusivamente el Node embebido del payload docente-local y falla con diagnóstico claro si falta; no cambia silenciosamente a `node` de PATH.
- REQ-006: El cierre ordenado o forzado solo se envía al dashboard verificado y el fallback termina únicamente el proceso/árbol cuya identidad continúa coincidiendo.
- REQ-007: La respuesta local de identidad/readiness usa un contrato versionado compartido por el launcher y AppHost; incluye versión del contrato, identificador de instancia, PID, hora de inicio, puerto, raíz canónica, ejecutable/runtime y estado de arranque. Los campos requeridos se validan estrictamente.
- REQ-008: La adopción de una instalación previa conserva compatibilidad mediante un adaptador explícito de contrato legado con límites de versión y validación estricta; no degrada silenciosamente la comprobación de identidad.
- REQ-009: Estados `starting`, `ready`, `degraded`, `stopping` y `failed` tienen significado único para launcher, API y AppHost; solo `ready` permite mostrar la aplicación como operativa.
- REQ-010: Una sola autoridad coordina inicio, reintento, reconciliación y cierre; AppHost solicita operaciones por contrato y no duplica reglas de lifecycle del launcher.

## Criterios de Aceptación

- Con PID del lock distinto del PID servido en `/api/install`, el Host no adopta ni manda shutdown.
- Con PID reutilizado cuyo ejecutable o hora de inicio no coincide, el Host rechaza la adopción y deja el proceso intacto.
- Web/API sanos sin dashboard propio no marcan la ventana como lista.
- Un arranque fallido no se convierte en éxito porque aparezcan puertos HTTP ajenos durante el timeout.
- Dos clics rápidos de reintento producen como máximo un dashboard.
- Payload sin runtime Node embebido falla antes de intentar iniciar servicios.
- Un dashboard propio recuperado sigue admitiendo la apertura y el cierre normal.
- Una instancia iniciada bajo el contrato legado compatible puede adoptarse solo si supera la validación completa disponible; contratos desconocidos o incompletos se rechazan con diagnóstico.
- Inicio, recuperación y cierre reportan estados/correlation ID coherentes en launcher, API y AppHost.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-003, REQ-006, REQ-007 | Identidad de lock, PID, puerto, root, instancia y ejecutable; no terminar proceso ajeno | `scripts/tests/app-host-shutdown.contract.test.mjs` | Aprobado; implementación pendiente |
| REQ-002, REQ-009 | Readiness y estado de lifecycle requieren servicio local propio | `scripts/tests/app-host-health.contract.test.mjs` | Aprobado; implementación pendiente |
| REQ-004, REQ-005, REQ-010 | Reintento serializado, runtime embebido y autoridad única de lifecycle | `scripts/tests/app-host-health.contract.test.mjs` | Aprobado; implementación pendiente |
| REQ-008, compatibilidad launcher | Migración/adaptador y lifecycle Node local | `scripts/tests/native-startup.contract.test.mjs` | Aprobado; implementación pendiente |

## Riesgos y decisiones

- `/api/install` actualmente expone PID, puerto, root y fecha de inicio; el implementador debe confirmar en runtime empaquetado el esquema exacto antes de depender de sus campos.
- Comparar solo puertos no establece propiedad; cerrar requiere identidad del proceso revalidada al momento del cierre.
- El cambio afecta la recuperación de procesos existentes y debe validarse con pruebas de integración Windows en un directorio QA aislado.
