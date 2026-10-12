---
id: SPEC-088
titulo: Arquitectura modular y contratos de ciclo de vida del Installer Hub
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: modulo_installer_windows
estado: approved
---

## Contexto

El Installer Hub se compone de Burn Bootstrapper Application en .NET/WPF, helper PowerShell 5.1, paquetes MSI/WiX, scripts Node del launcher y AppHost WPF. Hoy parte de los contratos está duplicada entre C#, PowerShell y Node; el helper mezcla coordinación, configuración, selección del payload, actualización y rollback; y cada superficie infiere readiness por señales distintas. La arquitectura debe permitir que esos componentes evolucionen con independencia sin introducir servicios distribuidos ni perder compatibilidad con instalaciones soportadas.

## Decisión de Arquitectura

- Mantener el despliegue local y los ejecutables actuales; no introducir microservicios, broker residente ni nuevas dependencias de producción.
- Definir contratos JSON versionados y un catálogo de capacidades/versiones compatible con .NET, Windows PowerShell 5.1 y Node embebido. Los contratos son la única interfaz entre Bootstrapper, helper, launcher/API y AppHost.
- Separar el helper en módulos por responsabilidad: contrato/validación, coordinación de operación, procesos, payload, configuración, verificación y recuperación. El script actual queda como adaptador de CLI compatible y delega en módulos explícitos.
- Designar una única autoridad de lifecycle por dominio: Burn coordina MSI/bootstrapper; el orquestador del helper coordina mutaciones de instalación; launcher supervisa dashboard/backend; AppHost consume identidad/readiness y solicita acciones por contrato.
- Usar una máquina de estados persistente para install/repair/update/uninstall y una transacción de archivos que cubra payload y configuración. Los estados son monotónicos, recuperables e idempotentes; datos SQLite y archivos de usuario quedan fuera de la transacción.
- Mantener compatibilidad mediante adaptadores explícitos, ventana de soporte declarada y rechazo diagnosticable de versiones no compatibles; no usar detección ambigua ni fallback permisivo.
- Emitir eventos estructurados con correlation ID, estado/etapa, versión de contrato y códigos de error; aplicar redacción por allowlist y nunca serializar secretos.

## Requisitos Funcionales

- REQ-001: Existe una definición versionada de contratos para invocaciones, respuesta/progreso, operación instalada y readiness; se valida en los tres lenguajes y rechaza campos/versiones desconocidos de forma segura.
- REQ-002: La capa coordinadora ejecuta transiciones válidas explícitas y es idempotente ante reintento, cierre del proceso, timeout o reinicio; estados incompletos se recuperan antes de una nueva mutación.
- REQ-003: Los módulos tienen responsabilidad única y no acceden directamente al estado privado de otro módulo; las dependencias fluyen desde el coordinador a capacidades por contratos documentados.
- REQ-004: Toda operación de instalación/actualización adquiere exclusión por raíz canónica y se ejecuta como preparar, validar, detener, promover, configurar, verificar y confirmar; cualquier error restaura payload/configuración previos o deja estado `recovery_required` que bloquea readiness.
- REQ-005: `data`, SQLite, respaldos y archivos de usuario están fuera del conjunto de archivos reemplazables; la migración de configuración explícita conserva claves no administradas y genera rollback verificable.
- REQ-006: La identidad/readiness de AppHost y launcher usa el mismo contrato y se verifica contra proceso, raíz, runtime, puerto, hora de inicio e instancia; un servicio HTTP sin dueño verificado no se adopta ni se cierra.
- REQ-007: Los secretos se transfieren mediante handoff privado y protegido, se excluyen de logs/eventos/respuestas y se eliminan al completar o expirar la operación; rutas/payload no se eligen por parámetros no confiables.
- REQ-008: La selección de artefacto se limita al payload del bundle identificado y verificado; el manifest declara hash, versión, arquitectura y capacidades y se comprueba antes de extracción.
- REQ-009: Los adaptadores soportan únicamente versiones de protocolo declaradas, registran la conversión y preservan comportamiento compatible; versiones fuera de la ventana fallan antes de mutación.
- REQ-010: La instrumentación permite reconstruir la secuencia de cada operación mediante correlation ID y eventos sanitizados sin guardar credenciales, configuración secreta ni datos de usuario.
- REQ-011: Los límites entre módulos están cubiertos por pruebas de contrato y pruebas de fallo para corrupción, concurrencia, caída entre estados, timeout, colisión de versión, payload inválido, permisos insuficientes y servicio ajeno en los puertos.
- REQ-012: Las comprobaciones de build aseguran que los archivos/módulos requeridos estén incluidos en el bundle firmado y que sus hashes coincidan con el manifest de release.
- REQ-013: La desinstalación retira el payload mediante la misma transacción recuperable, conserva `data` cuando no se solicita exportación/eliminación y guarda cualquier exportación en una ubicación privada del usuario; los datos externos a la raíz de instalación no se eliminan.

## Criterios de Aceptación

- Las definiciones de contrato son consumidas por C#, PowerShell y Node sin copias manuales divergentes; incompatibilidades se detectan en CI.
- Repetir o interrumpir una operación en cada estado produce un resultado determinista: rollback completo, commit confirmado o `recovery_required`, nunca éxito parcial.
- Un fallo de escritura/configuración, proceso, payload o verificación preserva la versión anterior y datos de usuario; el reinicio recupera o bloquea con diagnóstico accionable.
- Dos operaciones sobre la misma raíz no se intercalan y dos raíces distintas pueden progresar independientemente.
- AppHost abre, reintenta y cierra solo el proceso identificado; servicio ajeno sano, PID reutilizado y contrato desconocido no causan adopción ni terminación.
- Request alterado, ACL insegura, secreto en log, payload sustituto o ruta con reparse point no llegan a una mutación privilegiada.
- Un fallo durante desinstalación restaura los archivos de aplicación; sin exportación, `data` permanece intacto, y con exportación se verifica el respaldo antes de retirar datos dentro de la raíz.
- La versión previa declarada como compatible completa install, repair, update y uninstall por adaptador, conservando datos; una versión fuera de soporte falla sin cambiar instalación.
- El bundle final contiene todos los módulos y manifest firmado verificado; las pruebas corren sobre directorios y cuentas QA aisladas.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-009, REQ-012 | Contratos cruzados, versión, adaptadores y composición del bundle | `scripts/tests/installer-hub-architecture.contract.test.mjs` | Parcial; MSI y bundle QA 1.2.7 con identidad aislada compilan, validan versión/contenedor y extraen módulos/esquemas; falta firma Authenticode y promoción estable |
| REQ-002, REQ-004, REQ-005, REQ-011 | Estados, transacción, recuperación, preservación de datos y fault injection | `scripts/tests/installer-hub-lifecycle-contract.test.mjs`, `scripts/tests/installer-hub-contract.test.mjs` | Parcial; inyección aislada durante promoción y rollback automático pasan; falta E2E en Windows con ACL/UAC y fallos de disco/proceso |
| REQ-013 | Desinstalación transaccional, respaldo privado y preservación de datos | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Parcial; falta E2E con exportación/desinstalación en Windows |
| REQ-003, REQ-010 | Límites modulares, trazas y redacción | `scripts/tests/installer-hub-architecture.contract.test.mjs`, `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Parcial; contratos, procesos, transacción, payload, verificación y configuración separados, y el bundle QA extraído contiene los módulos; falta E2E de límites con ACL/UAC/procesos reales |
| REQ-006 | Identidad/readiness y cierre de AppHost | `scripts/tests/app-host-health.contract.test.mjs` | Parcial; contrato implementado y compilado; falta validar runtime Windows |
| REQ-007, REQ-008 | Handoff seguro y origen/verificación de payload | `scripts/tests/installer-hub-contract.test.mjs` | Parcial; handoff, selección limitada y payload del bundle QA verificados; falta firma y verificación Authenticode del artefacto estable |
| Compatibilidad de release y recorridos | Install/repair/update/uninstall del paquete docente-local | `scripts/tests/installer-hub-e2e-docente.ps1` | Pendiente de ejecución Windows |

## Riesgos y Decisiones

- La matriz exacta de releases anteriores soportadas debe derivarse de tags y contratos comprobables; no asumir que todo instalador histórico sigue siendo compatible.
- La elevación UAC, DPAPI, ACL y Authenticode requieren pruebas reales en Windows con cuenta estándar y administrador; los contratos estáticos no bastan.
- El rollback de `data` está expresamente excluido para evitar sobrescribir SQLite o información del usuario; migraciones de base de datos tienen su propia política de backup/compatibilidad.
- El cambio se integra por pasos detrás de adaptadores de contrato y sin cambiar URLs o CLI públicas hasta demostrar compatibilidad.
