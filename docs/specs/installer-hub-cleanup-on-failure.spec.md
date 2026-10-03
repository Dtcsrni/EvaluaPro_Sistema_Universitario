---
id: SPEC-INSTALLER-ROLLBACK-CLEANUP
titulo: Limpieza y Rollback Automatico ante Fallos de Instalacion
version: 1.3.0
fecha: 2026-10-03
autor: Codex / Agente IA
modulo: modulo_installer_windows
estado: approved
---

# SPEC-INSTALLER-ROLLBACK-CLEANUP: Limpieza y Rollback Automatico ante Fallos de Instalacion

## Contexto
Si el proceso de instalacion de EvaluaPro se interrumpe, cancela o falla en cualquiera de sus etapas, el sistema debe quedar limpio.

## Requisitos Funcionales
- REQ-001: En caso de error fatal se invoca Invoke-RollbackOnFailure.
- REQ-002: La creación o reconciliación de accesos directos es degradable; un fallo debe registrarse y permitir terminar si el payload, configuración operativa, runtime SQLite y manifiesto de actualización son válidos.
- REQ-003: Si el paso de accesos directos falla o no deja el manifiesto de instalación, el helper debe generarlo de forma independiente. Si tampoco puede generarlo, la instalación falla con diagnóstico y rollback seguro.
- REQ-004: El helper informa en el log de Burn las etapas del post-install; al vencer el timeout, registra las últimas líneas disponibles de stdout y stderr antes del rollback.
- REQ-005: El post-install docente usa exclusivamente el runtime Node incluido en el payload, valida que sea Node.js 24.x y falla con diagnóstico inmediato si falta o no es válido. No descarga runtimes durante la instalación.
- REQ-006: El pipeline Windows ejecuta install, repair, dashboard, verificación de actualización y uninstall con el bundle que se publicará; conserva el reporte E2E y bloquea la publicación ante cualquier falla.
- REQ-007: La expansión del payload nativo evita una segunda copia completa del árbol y usa el extractor ZIP nativo de Windows cuando está disponible, conservando validación y staging temporal.
- REQ-008: El runner E2E captura stdout/stderr del ciclo de datos dummy y limita su duración, para que un error de fixture quede en el reporte y no se pierda por el manejo de procesos nativos de PowerShell.
- REQ-009: El workflow E2E instala bajo un directorio `EvaluaPro-QA-Isolated-*` en LOCALAPPDATA y fuerza DATABASE_URL a la SQLite de esa raíz, para que runtime y limpieza del fixture usen la misma base aislada.
- REQ-010: Si Windows PowerShell no expone ExitCode aunque el proceso haya terminado, el runner acepta el ciclo dummy solo cuando su JSON demuestra cuenta, 3 materias, 3 alumnos, verificación y limpieza completa.

## Criterios de Aceptación
- Fallos en post-install no dejan archivos huerfanos.
- El fallo exclusivo de accesos directos no desinstala el MSI; la respuesta del helper conserva `ok=true`, `degraded=true` y un warning legible.
- La instalación continúa siendo bloqueante ante errores de payload, configuración operativa, SQLite, runtime requerido o manifiesto de actualización.
- Cada etapa crítica del post-install queda identificable en el log aunque una etapa posterior quede bloqueada.
- La instalación docente no requiere acceso a nodejs.org; un paquete sin `runtime/node/node.exe` se rechaza con un error explícito.
- El release de Windows no publica el bundle hasta que el ciclo E2E completo del artefacto final termina correctamente.
- La extracción valida los archivos requeridos antes de mover el staging al destino y no copia de nuevo el árbol completo de dependencias.
- El ciclo dummy termina en 180 segundos como máximo y conserva stdout/stderr por separado, incluido el caso de fallo.
- El bundle E2E configura y prepara SQLite dentro del directorio aislado del runner, nunca en la base compartida de `ProgramData`.
- Un ExitCode nulo nunca basta por sí solo para declarar éxito del ciclo dummy; se requiere toda la evidencia estructurada de creación, verificación y limpieza.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Rollback automático y limpieza ante fallos | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-002 | Fallo de accesos directos degrada sin desinstalar el MSI | `scripts/tests/installer-hub-contract.test.mjs` | Completado |
| REQ-003 | Manifiesto de instalación independiente para actualización | `scripts/tests/installer-hub-contract.test.mjs` | Completado |
| REQ-004 | Trazas por etapa y salida retenida ante timeout | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-005 | Runtime Node autocontenido y validado sin descarga de red | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-006 | E2E completa obligatoria del bundle de release y conservación de evidencia | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-007 | Extracción ZIP rápida con publicación desde staging sin duplicar escrituras | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-008 | Ciclo dummy con timeout y stdout/stderr capturados en el artefacto E2E | `scripts/tests/installer-hub-contract.test.mjs` | En validación |
| REQ-009 | Workflow E2E y helper comparten SQLite confinada bajo LOCALAPPDATA | `scripts/tests/installer-hub-lifecycle-contract.test.mjs`, `scripts/tests/installer-hub-contract.test.mjs` | En validación |
| REQ-010 | Fallback estricto por ExitCode nulo con evidencia estructurada del ciclo dummy | `scripts/tests/installer-hub-contract.test.mjs` | En validación |
