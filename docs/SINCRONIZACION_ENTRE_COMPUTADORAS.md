# Sincronizacion entre computadoras

Este modulo permite mover datos operativos por tres vias independientes:
1. Instantanea local 1:1 por archivo (`.ep-snapshot`).
2. Paquete parcial compatible (`.ep-sync.json`).
3. Servidor intermedio (`push/pull`).

## Trabajo coordinado con OneDrive

Desde el área Cuenta/Configuración, cada docente selecciona la carpeta local
que su cliente de OneDrive ya sincroniza. La preferencia queda guardada por
cuenta e instalación; `EVALUAPRO_SYNC_CLOUD_DIR` se conserva únicamente como
respaldo para despliegues automatizados. La aplicación activa un lease temporal por
docente y equipo. El backend exige ese lease para las escrituras; el primer
equipo trabaja en modo escritura y los demás quedan en solo lectura. El
cliente renueva el lease mientras la sesión está abierta y lo libera al
publicar o de forma explícita. Si el equipo se apaga, el lease expira sin
borrar la última instantánea válida.

La carpeta contiene `evaluapro.manifest.json`, snapshots cifrados versionados y
`.evaluapro.lease.json`. No contiene la SQLite viva, contraseñas, tokens ni
secretos. La carpeta sincronizada es el transporte del piloto; por las
limitaciones de sincronización eventual de OneDrive, una garantía distribuida
fuerte requiere sustituir el proveedor por uno con escritura condicional.

## Instantanea local 1:1

La instantanea local contiene la SQLite canonica y los archivos de
`data/examenes` dentro de un solo archivo cifrado y autenticado. No contiene
`.env`, tokens, logs, cache WebView2 ni binarios. OneDrive, USB o una carpeta
compartida solo transportan el archivo; nunca deben sincronizar directamente la
SQLite viva.

El desbloqueo se realiza con la contraseña actual de la cuenta docente o con
una reautenticacion Google. Google verifica la credencial contra Google y usa
la clave de sincronizacion configurada en `EVALUAPRO_BACKUP_CIFRADO_SECRETO`;
el token Google no se usa como clave criptografica. Esta variable debe ser
igual en los equipos del mismo docente y nunca debe publicarse.

La importacion 1:1 valida propietario, hashes de archivos, formato SQLite y
`PRAGMA integrity_check`; despues crea un respaldo local y reemplaza la base y
los artefactos. Si falla el reemplazo, restaura el respaldo y reconecta SQLite.
Al terminar correctamente se cierra la sesion para que el equipo recargue el
identificador de docente contenido en la instantanea.

## Cobertura
- Periodos y materias
- Alumnos
- Banco de preguntas
- Plantillas
- Examenes generados
- Entregas
- Calificaciones
- Banderas de revision
- PDFs comprimidos (opcional)

## Garantias
- Integridad: checksum SHA-256.
- Conflictos: estrategia LWW por `updatedAt`.
- En el modo coordinado no hay merge ni LWW: solo el equipo con lease puede publicar.
- Idempotencia practica en reimportacion.
- Auditoria por estado de sincronizacion.

## Contrato de backup
- `schemaVersion: 2`
- `businessLogicFingerprint: sync-v2-lww-updatedAt-schema2`
- `createdAt`, `ttlMs`, `expiresAt`

Un backup es invalido si:
1. `expiresAt` no existe o no es valido.
2. `Date.now() > expiresAt`.
3. Fingerprint distinto al esperado.

## Endpoints backend
- `POST /api/sincronizaciones/local/exportar`
- `POST /api/sincronizaciones/local/importar`
- `GET /api/sincronizaciones/local/lease`
- `GET /api/sincronizaciones/local/configuracion`
- `POST /api/sincronizaciones/local/configuracion/carpeta`
- `POST /api/sincronizaciones/local/lease/adquirir`
- `POST /api/sincronizaciones/local/lease/renovar`
- `POST /api/sincronizaciones/local/lease/liberar`
- `POST /api/sincronizaciones/local/nube/publicar`
- `GET /api/sincronizaciones/local/nube/descargar`
- `POST /api/sincronizaciones/local/nube/importar`
- `POST /api/sincronizaciones/paquete/exportar`
- `POST /api/sincronizaciones/paquete/importar`
- `POST /api/sincronizaciones/push`
- `POST /api/sincronizaciones/pull`
- `GET /api/sincronizaciones?limite=N`

## Flujo recomendado
1. En el equipo emisor, exportar la instantanea local y mover el `.ep-snapshot`.
2. En el equipo receptor, seleccionar el mismo metodo de desbloqueo y ejecutar
   primero la validacion (`dryRun`) desde la interfaz.
3. Confirmar el reemplazo y volver a iniciar sesion.
4. Usar `push/pull` o el paquete parcial solo cuando se necesite sincronizacion
   por registros con merge/LWW; no mezclarlos con la instantanea 1:1.

## Flujo coordinado recomendado

1. Iniciar sesión con la misma cuenta de OneDrive en todos los equipos y,
   dentro de EvaluaPro, seleccionar en cada instalación la misma carpeta
   sincronizada. OneDrive se encarga de transportar sus contenidos.
2. Abrir EvaluaPro: el equipo que obtenga el lease queda en escritura; los
   demás consultan la última instantánea en solo lectura.
3. En el equipo activo, elegir la contraseña docente o reautenticar Google,
   y usar `Publicar y liberar` al terminar.
4. En otro equipo, adquirir el lease y usar `Traer última instantánea`; la
   importación crea respaldo local, valida SQLite y reinicia la sesión.
5. No abrir dos equipos para editar mientras el estado de OneDrive esté
   pendiente de sincronización.

## Mantenimiento
- Si cambia logica incompatible, actualizar fingerprint y documentar en `CHANGELOG.md`.
- Mantener validaciones de backend y frontend alineadas.

## Verificacion del transporte de carpeta

La E2E de dos equipos usa filesystem real y, por defecto, una carpeta temporal
fuera del repositorio. Para probar el mismo flujo dentro de una carpeta que
OneDrive administre localmente, definir `EVALUAPRO_SYNC_E2E_CLOUD_DIR` al
ejecutar `tests/sincronizacion.dos-equipos.e2e.test.ts`. La prueba no elimina
una carpeta proporcionada por el ejecutor; la limpieza queda bajo su control.
