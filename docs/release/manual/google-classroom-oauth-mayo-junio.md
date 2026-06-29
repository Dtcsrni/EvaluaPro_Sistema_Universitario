# OAuth Google Classroom - mayo-junio

Esta guia cierra la parte que no puede generarse desde el repo: `client_id`, `client_secret` y autorizacion OAuth real de Google Classroom.

## Datos que debes obtener en Google Cloud

1. Entrar a Google Cloud Console con una cuenta administradora o docente autorizada.
2. Crear o seleccionar un proyecto para EvaluaPro.
3. Habilitar APIs:
   - Google Classroom API.
   - Google Identity Services / OAuth consent screen.
4. Configurar OAuth consent screen:
   - Tipo: interno si el dominio Google Workspace pertenece a la institucion; externo solo si aplica.
   - Scopes minimos Classroom requeridos por el flujo real de la app.
   - Usuarios de prueba: agregar la cuenta docente que ejecutara mayo-junio si el consentimiento no esta publicado.
5. Crear credencial OAuth:
   - Tipo: Web application.
   - Authorized redirect URI:

```text
http://localhost:4000/api/integraciones/classroom/oauth/callback
```

Si se valida contra dominio productivo, registrar tambien:

```text
https://<dominio>/api/integraciones/classroom/oauth/callback
```

6. Copiar estos valores sin pegarlos en chat:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_CLASSROOM_CLIENT_ID`
   - `GOOGLE_CLASSROOM_CLIENT_SECRET`
   - `GOOGLE_CLASSROOM_REDIRECT_URI`

## Aplicar en EvaluaPro

Ejecutar desde `V:\Software\EvaluaPro`:

```powershell
pwsh -File scripts\configurar-oauth-classroom.ps1 `
  -GoogleOauthClientId "<oauth-client-id>" `
  -GoogleClassroomClientId "<classroom-client-id>" `
  -GoogleClassroomClientSecret "<classroom-client-secret>" `
  -GoogleClassroomRedirectUri "http://localhost:4000/api/integraciones/classroom/oauth/callback" `
  -AlsoSetViteGoogleClientId
```

El script genera o conserva `CLASSROOM_TOKEN_CIPHER_KEY` en `.env`. No versionar `.env`.

Validar:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run classroom:doctor
```

Debe devolver `"ok": true`.

## Evidencia de release

Despues de operar la UI docente con el curso real mayo-junio:

1. Completar `docs\release\manual\classroom-e2e-real-mayo-junio.json`.
2. No incluir tokens, secrets ni correos completos.
3. Ejecutar:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run release:check:classroom-e2e -- `
  --manual=docs/release/manual/classroom-e2e-real-mayo-junio.json
```

4. Cerrar stable:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run release:validate:stable -- `
  --version=1.1.0 `
  --repo=Dtcsrni/EvaluaPro_Sistema_Universitario `
  --ci-green=13
```

## Limite real

El repo puede generar llave de cifrado, `.env`, plantillas y validadores. No puede generar `client_secret` ni conceder scopes de Classroom sin acceso a Google Cloud Console y a una cuenta Google autorizada.
