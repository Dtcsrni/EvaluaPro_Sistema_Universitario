---
id: SPEC-048
titulo: Sincronización de Paquetes Offline y Nube Institucional
version: 3.0.0
fecha: 2026-09-01
autor: Antigravity / EvaluaPro Team
modulo: modulo_sincronizacion
estado: approved
---

## Contexto
Operación local de producción-piloto en dos equipos del mismo docente. La base canónica es SQLite local y los archivos generados viven en el almacenamiento local de datos. OneDrive puede transportar una instantánea, pero no debe sincronizar una SQLite viva. El docente necesita transferir todo su estado 1-1 mediante un solo archivo cifrado.

## Requisitos Funcionales
- **REQ-001 (Instantánea local completa)**: Exportar la SQLite canónica y los archivos de datos transferibles a un único archivo cifrado y autenticado.
- **REQ-002 (Credencial de cuenta)**: Permitir desbloqueo con la contraseña de la cuenta docente, sin almacenarla. La derivación de clave debe ser resistente a ataques de diccionario.
- **REQ-003 (Google)**: Permitir desbloqueo mediante la cuenta Google autenticada; esta modalidad requiere conexión para obtener o desbloquear la clave de cuenta y nunca usa el token como clave criptográfica.
- **REQ-004 (Importación 1-1)**: Validar propietario, versión, integridad y SQLite antes de crear respaldo y reemplazar la base y archivos locales. No fusionar ni aplicar LWW en esta modalidad.
- **REQ-005 (Sincronización Cloud existente)**: Mantener push/pull y paquetes parciales como modalidad independiente, sin cambiar su contrato.
- **REQ-006 (Lease de escritura)**: Permitir adquirir un bloqueo temporal por docente y equipo antes de editar/publicar una instantánea. El lease debe tener expiración y renovación.
- **REQ-007 (Modo lectura)**: Rechazar la edición/publicación cuando otro equipo posee un lease vigente, informando equipo, adquisición y expiración sin revelar credenciales.
- **REQ-008 (Publicación coordinada)**: Publicar la instantánea cifrada únicamente con un lease vigente del mismo equipo y liberar el lease después de confirmar checksum y metadatos.
- **REQ-009 (Recuperación)**: Si se pierde la renovación del lease, detener la publicación y pasar a modo lectura; permitir recuperar un lease expirado sin borrar datos remotos.
- **REQ-010 (Proveedor de transporte)**: Encapsular el almacenamiento en nube mediante un proveedor configurable. OneDrive sincronizado por carpeta es transporte de piloto; un proveedor con escritura condicional debe usarse cuando se requiera garantía distribuida fuerte.
- **REQ-011 (Carpeta definida por docente)**: Permitir que el docente seleccione desde `Cuenta → Datos y sincronización` la carpeta local que su cliente de OneDrive sincroniza. La preferencia se conserva por instalación y cuenta, no contiene secretos y prevalece sobre la configuración de entorno.

## Criterios de Aceptación
1. El docente puede exportar un único archivo cifrado que contiene la SQLite de producción-piloto y los archivos transferibles asociados.
2. El archivo puede importarse 1-1 en otro equipo del mismo docente mediante contraseña o Google según la disponibilidad de conexión.
3. Una importación inválida no modifica la instalación; una importación válida conserva un respaldo y valida `integrity_check` antes del reemplazo.
4. El archivo no contiene contraseñas, tokens ni secretos de configuración en claro.
5. Push/pull cloud conserva su comportamiento existente y sigue usando LWW sólo en su modalidad.
6. Las pruebas de backend, frontend y contratos cubren ambas rutas de desbloqueo y el rechazo de archivos alterados.
7. Dos equipos para el mismo docente no pueden publicar simultáneamente mientras ambos observan el lease vigente.
8. El cierre, expiración o pérdida de renovación del lease no elimina la última instantánea válida.
9. El docente puede seleccionar y cambiar la carpeta de transporte; el sistema valida que sea una carpeta absoluta, persistente y distinta del almacenamiento SQLite local. OneDrive es responsable de sincronizarla entre equipos.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Instantánea SQLite local completa | `apps/backend/tests/sincronizacion.snapshot.test.ts` | Completado |
| REQ-002 | Desbloqueo con contraseña docente | `apps/backend/tests/sincronizacion.snapshot.test.ts` | Completado |
| REQ-003 | Desbloqueo con Google y requisito de conexión | `apps/backend/tests/sincronizacion.snapshot.test.ts` | Parcial: ruta real implementada y cierre seguro verificado sin credencial; falta validación end-to-end con una cuenta Google real |
| REQ-004 | Importación 1-1, backup e integrity check | `apps/backend/tests/sincronizacion.snapshot.test.ts` | Completado |
| REQ-005 | Paquetes parciales y push/pull existentes | `apps/frontend/tests/seccionSincronizacionEquipos.test.tsx` | Completado |
| REQ-006 | Lease temporal por docente/equipo | `apps/backend/tests/sincronizacion.lease.test.ts` | Completado |
| REQ-007 | Bloqueo de segundo escritor y modo lectura | `apps/backend/tests/sincronizacion.lease.test.ts` | Completado |
| REQ-008 | Publicación con lease y liberación | `apps/backend/tests/sincronizacion.lease.test.ts` | Completado |
| REQ-009 | Expiración y recuperación segura | `apps/backend/tests/sincronizacion.lease.test.ts` | Completado |
| REQ-010 | Proveedor de transporte configurable | `apps/backend/tests/sincronizacion.lease.test.ts` | Parcial: proveedor de carpeta sincronizada para piloto; falta proveedor con escritura condicional |
| REQ-011 | Carpeta de transporte seleccionada por docente | `apps/backend/tests/sincronizacion.lease.test.ts` | Completado |
