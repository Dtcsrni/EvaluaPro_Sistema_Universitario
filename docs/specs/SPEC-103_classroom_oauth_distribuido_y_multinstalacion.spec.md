---
id: SPEC-103
titulo: Classroom disponible en todas las instalaciones del flavor docente
version: 0.1.0
fecha: 2026-10-23
autor: Codex / EvaluaPro
modulo: modulo_integraciones_classroom, instalador_burn
estado: approved
---

## Contexto

En la versión inspeccionada, la integración requiere credenciales OAuth y
`CLASSROOM_TOKEN_CIPHER_KEY` por instalación. El instalador no los proporciona;
por eso copiar manualmente el `.env` de desarrollo al runtime habilitó Classroom
en una máquina, pero no resuelve el requisito de disponibilidad general. La
implementación previa usaba client secret/redirect estáticos, no añadía PKCE y
cifraba el refresh token con la llave de entorno.

La documentación oficial de Google trata las aplicaciones de escritorio
instaladas como clientes públicos, indica que no pueden mantener un secreto
confidencial y recomienda PKCE con redirect loopback. Por tanto, distribuir el
client secret actual dentro del instalador no satisface el requisito de
seguridad. El requisito funcional es que Classroom quede disponible en todas las
instalaciones soportadas, y que cada docente vincule su propia cuenta Google con
consentimiento explícito. El único alcance actual es el flavor docente
`docente-local`.

## Objetivo

Eliminar la configuración manual por instalación como prerrequisito de
Classroom, manteniendo la vinculación por docente, mínimo privilegio, identidad
Google verificada y protección de tokens persistentes.

## Requisitos Funcionales

- **REQ-001 (Disponible por instalación docente):** Todas las instalaciones del
  flavor `docente-local` habilitan Classroom sin copiar o editar un `.env`
  local.
  Si no existe una cuenta vinculada, la GUI ofrece iniciar la vinculación y
  explica el consentimiento que Google solicitará. La ausencia de vínculo no
  bloquea las demás funciones de EvaluaPro.
- **REQ-002 (Credenciales aptas para cliente instalado):** El flujo de la
  instalación de escritorio usa credenciales OAuth de aplicación instalada y no
  depende de un `client_secret` compartido tratado como confidencial. Cada
  solicitud de autorización usa `state` anti-CSRF y PKCE (`S256`); el listener
  loopback usa puerto disponible, acepta solo el callback esperado, valida
  issuer/state y se cierra al terminar o expirar. Los redirect URIs quedan
  conformes al tipo de credencial OAuth configurado en Google Cloud.
- **REQ-003 (Identidad y vínculo docente):** Solo se vincula una cuenta cuya
  identidad Google verificada (`sub`) coincida con la identidad de login
  EvaluaPro exigida por SPEC-100. Se conserva el vínculo anterior ante
  cancelación, mismatch o error. Cada docente mantiene datos de autorización
  separados y puede desconectar/revocar su vínculo.
- **REQ-004 (Scopes y consentimiento):** Se solicitan únicamente scopes
  necesarios para los cursos, temas, actividades, roster y entregas que la
  persona docente haya decidido consultar/importar. El flujo muestra permisos y
  propósito antes de enviar al sistema de consentimiento de Google. Acceso a
  archivos adjuntos de Drive que requiera scopes adicionales no se asume ni se
  habilita silenciosamente.
- **REQ-005 (Protección de tokens persistentes):** Los refresh/access tokens
  nunca se guardan en texto plano, logs o artefactos. En `docente-local` se usa
  DPAPI `CurrentUser` bajo la misma identidad Windows que ejecuta el backend.
  El mecanismo, contexto de usuario, copia de seguridad, restauración y
  recuperación quedan definidos antes de producción.
- **REQ-006 (Migración del vínculo existente):** Una actualización convierte
  tokens cifrados con el mecanismo previo solo cuando puede descifrarlos y
  persistirlos bajo el mecanismo nuevo, valida la nueva lectura y después
  completa la transición. Si no puede convertirlos, conserva los registros y
  ofrece reconexión; no los borra ni simula una conexión exitosa. Las
  instalaciones nuevas no necesitan la llave antigua en `.env`.
- **REQ-007 (Configuración del producto):** El client ID público necesario se
  publica con `docente-local` como configuración no secreta y versionada. El ID
  creado en Google Cloud es
  `1088901330711-g285eauro5dmickq5p6t6doduch84h0k.apps.googleusercontent.com`. No se
  solicitan ni distribuyen `client_secret`, redirects fijos ni llaves
  criptográficas como valores manuales por instalación.
- **REQ-008 (Doctor y diagnósticos):** El doctor de instalación `docente-local`
  valida disponibilidad del módulo, OAuth client type, PKCE, almacenamiento
  seguro, redirect/callback y scopes requeridos sin imprimir secretos ni tokens.
  Explica si hace falta que el docente vincule cuenta, si falta configuración
  pública del producto o si Google solicita verificación de la app.
- **REQ-009 (Operación independiente):** Cursos, temas y actividades se pueden
  consultar después de vincular la cuenta docente aunque no se haya ejecutado
  `configurar-oauth-classroom.ps1` ni se hayan copiado secretos al runtime. La
  integración diferencia con errores accionables: no vinculado, autorización
  revocada, consentimiento faltante, configuración de producto inválida y fallo
  temporal de Google.

## Criterios de Aceptación

1. Una instalación limpia de `docente-local` presenta el módulo Classroom sin
   editar su `.env`; el vínculo se crea por la cuenta docente y consentimiento
   en Google. La validación de release cubre todas las instalaciones de este
   flavor.
2. La prueba de autorización verifica `code_challenge_method=S256`, el callback
   loopback registrado, validación única de `state`, rechazo de estados
   vencidos/reutilizados y cierre del listener.
3. El código de producción y los artefactos publicados no contienen
   `client_secret`, refresh token ni llave maestra de cifrado compartida.
4. Tokens guardados no pueden descifrarse desde otra identidad local. Pruebas
   reales en Windows cubren escritura, lectura, reinicio, actualización,
   restauración bajo el mismo perfil y recuperación/reconexión al restaurar en
   otro perfil o equipo.
5. La migración de una conexión preexistente funciona con la llave correcta y
   deja datos intactos con llave incorrecta/ausente; el segundo caso permite
   reconectar sin falsos positivos ni pérdida silenciosa.
6. La cuenta conectada pasa por el curso elegido, temas, actividades y fechas de
   SPEC-102, conservando aislamiento por docente y permisos de solo lectura.
7. Se valida el flujo contra Google real en un runtime instalado de
   `docente-local` y se registra OAuth, scopes concedidos, identidad verificada,
   consulta de cursos/temas/actividades y reconexión.
8. La promoción estable bloquea si el Client ID Desktop versionado no está en el
   paquete, falla el doctor, la identidad no coincide o la evidencia instalada
   no corresponde al SHA/versión candidata. La publicación OAuth debe permitir
   las cuentas previstas; el estado de prueba de Google, sus usuarios permitidos
   y la verificación de scopes se comprueban antes de liberar.

## Matriz de Trazabilidad

| Requisito | Evidencia prevista |
| --- | --- |
| REQ-001 | `scripts/tests/installer-hub-e2e-docente.ps1`; `scripts/tests/classroom-doctor.test.mjs` |
| REQ-002 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/backend/tests/integracion/classroom.v2.test.ts` |
| REQ-003 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/backend/tests/integracion/classroom.v2.test.ts` |
| REQ-004 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `scripts/tests/classroom-doctor.test.mjs` |
| REQ-005 | `scripts/tests/classroom-dpapi.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` |
| REQ-006 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `scripts/tests/classroom-dpapi.test.mjs` |
| REQ-007 | `scripts/tests/classroom-doctor.test.mjs`; `scripts/tests/installer-hub-contract.test.mjs` |
| REQ-008 | `scripts/tests/classroom-doctor.test.mjs`; `apps/frontend/tests/seccionClassroom.test.tsx` |
| REQ-009 | `scripts/tests/installer-hub-e2e-docente.ps1`; `apps/backend/tests/integracion/classroom.v2.test.ts` |

## Decisiones de arquitectura y validación

El alcance de esta especificación es exclusivamente `docente-local`. La persona
docente aprobó un OAuth client de escritorio público compartido por el producto,
con PKCE S256 y callback loopback en puerto aleatorio, sin distribuir el
`client_secret`. Los tokens heredados se descifran con la configuración antigua
solo durante la migración y se vuelven a cifrar con DPAPI bajo la identidad efectiva del backend; los datos nuevos no
dependen de `CLASSROOM_TOKEN_CIPHER_KEY`.

Se debe comprobar que la identidad de ejecución de `docente-local` puede usar
ese callback y recuperar los tokens durante instalación, reparación,
actualización y reinicio. También se validarán las
restricciones de verificación OAuth de Google, redirects loopback, scopes y
soporte de PKCE en la versión fijada de `google-auth-library`.

## Fuentes técnicas primarias

- Google, OAuth 2.0 para aplicaciones de escritorio: clientes instalados como
  públicos, uso de PKCE y redirect loopback:
  <https://developers.google.com/identity/protocols/oauth2/native-app>
- Google, buenas prácticas OAuth: secretos de servidor y protección de tokens:
  <https://developers.google.com/identity/protocols/oauth2/resources/best-practices>
- SPEC-053 define guardrails del runtime OAuth actual; SPEC-100 define identidad,
  reconexión y resiliencia Classroom; SPEC-102 define la consulta de actividades.

## Estado SDD

`approved`: la persona docente aprobó `docente-local`, OAuth de escritorio con
PKCE y loopback, y DPAPI bajo la misma identidad Windows que ejecuta el backend.
La implementación debe demostrar la identidad de ejecución y preservar o
permitir reconectar vínculos durante la migración; los gates Windows reales
siguen siendo obligatorios antes de publicar.
