# Evidencia 1.1.0

Esta carpeta conserva evidencia local de calidad para la candidata 1.1.0.

La decision actual es **Go** bajo el contrato estable vigente:

- `ci-streak`: 14 corridas CI consecutivas en verde sobre `main`.
- `release-evidence`: evidencia versionada 1.1.0 completa.
- `automated-qa-evidence`: `reports/qa/latest/manifest.json` en `ok` con evidencia UX/UI y flujo docente.
- `installer-multi-flavor`: manifest de instalador multi-flavor con artefactos firmados y checksums.

La evidencia humana productiva y Classroom real se conservan como smoke operativo opcional; no bloquean la promocion estable si la QA automatizada obligatoria esta completa.

Como apoyo operativo, existe un smoke local separado para el periodo mayo-junio:

```powershell
node scripts\release\prod-flow-local-smoke.mjs
```

Ese smoke genera `docs/release/evidencias/1.1.0-local.0/` con `gateHumanoProduccion.entorno=local-smoke` y valida API local, JWT local, exportaciones CSV/DOCX/firma, integridad SHA-256 y metricas.

## Smoke prod-flow mayo-junio opcional

Para ejecutar un smoke productivo del periodo mayo-junio:

1. Autenticarse contra la API candidata y exportar el JWT docente como `RELEASE_GATE_DOCENTE_TOKEN`.
2. Exportar la API backend como `RELEASE_GATE_API_BASE`, por ejemplo `https://<dominio>/api` o `http://localhost:3000/api`.
3. Resolver el `periodoId` interno del periodo mayo-junio con `GET /api/periodos`.
4. Copiar `docs/release/manual/prod-flow-1.1.0-mayo-junio.template.json` a `docs/release/manual/prod-flow-1.1.0-mayo-junio.json` y marcar los campos booleanos en `true` solo despues de operar el flujo real.
5. Ejecutar:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run release:gate:prod-flow -- `
  --version=1.1.0 `
  --periodo-id=<periodo-id-real-mayo-junio> `
  --manual=docs/release/manual/prod-flow-1.1.0-mayo-junio.json
```

## Smoke Classroom real mayo-junio opcional

Para ejecutar el smoke externo de Google Classroom:

0. Obtener credenciales y scopes siguiendo `docs/release/manual/google-classroom-oauth-mayo-junio.md`.

1. Configurar OAuth/Classroom sin versionar secretos:

```powershell
pwsh -File scripts\configurar-oauth-classroom.ps1 `
  -GoogleOauthClientId "<oauth-client-id>" `
  -GoogleClassroomClientId "<classroom-client-id>" `
  -GoogleClassroomClientSecret "<classroom-client-secret>" `
  -GoogleClassroomRedirectUri "https://<dominio>/api/integraciones/classroom/oauth/callback"
```

2. Validar prerequisitos locales sin imprimir secretos:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run classroom:doctor
```

3. Operar desde la UI docente el flujo real: OAuth, listado de curso mayo-junio, roster, mapeo, actividad, preview, importacion persistente, reimportacion idempotente, filtros de roster/preview e historial.
4. Copiar `docs/release/manual/classroom-e2e-real-mayo-junio.template.json` a `docs/release/manual/classroom-e2e-real-mayo-junio.json`.
5. Completar solo datos no sensibles: ids de curso/actividad, conteos, requestIds y rutas/ids de capturas; no guardar tokens, secretos ni correos sensibles completos.
6. Marcar `resultado` como `ok` solo cuando todos los pasos booleanos esten en `true`.
7. Validar:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run release:check:classroom-e2e -- `
  --manual=docs/release/manual/classroom-e2e-real-mayo-junio.json
```

## Validacion stable final

Comando validado:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run release:validate:stable -- `
  --version=1.1.0 `
  --repo=Dtcsrni/EvaluaPro_Sistema_Universitario `
  --ci-green=13
```
