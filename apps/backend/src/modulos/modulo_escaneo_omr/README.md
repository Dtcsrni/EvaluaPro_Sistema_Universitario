# modulo escaneo omr

Módulo de dominio del backend docente (rutas, controlador, servicios, modelos y validaciones).

Ruta: `apps/backend/src/modulos/modulo_escaneo_omr`.

## Archivos clave
- `controladorEscaneoOmr.ts`
- `omrCore.ts`
- `rutasEscaneoOmr.ts`
- `servicioOmr.ts`
- `validacionesOmr.ts`

## Reglas de mantenimiento
- Mantener cambios pequeños y trazables con pruebas/validación asociada.
- Actualizar documentación relacionada cuando cambie el comportamiento observable.
- Respetar multi-tenancy por docente y contratos de error/validación.

## Perfil geometrico operativo
- Variable principal: `OMR_GEOMETRY_PROFILE`.
- Valores soportados:
	- `actual` (default)
	- `geo_tight_search` (ganador del sweep geométrico)
- En `NODE_ENV=production`, cualquier perfil distinto de `actual` se ignora salvo que se defina `OMR_GEOMETRY_PROFILE_FORCE_PROD=true`.
- Overrides explícitos por variable (`OMR_ALIGN_RANGE`, `OMR_VERT_RANGE`, `OMR_LOCAL_SEARCH_RATIO`, `OMR_OFFSET_X`, `OMR_OFFSET_Y`) siguen teniendo prioridad sobre el perfil.

### Activación rápida
- `npm run dev:omr:geo-tight` inicia backend local con `geo_tight_search`.
- `npm run dev:omr:actual` inicia backend local con perfil base.

## Runtime OMR único
- La fachada `servicioOmr.ts` ejecuta el pipeline OMR CV TV3.
- El motor operativo se mantiene en `servicioOmrCv.ts` y módulos `omr/*`.
- No existe fallback runtime alterno.

## Runtime CV (backend obligatorio)
- El preproceso CV de OMR TV3 es obligatorio en runtime.
- No existe backend alterno ni fallback `simple`.
- Si el backend CV no está disponible, el backend falla en arranque (smoke test bloqueante).
- `OMR_CV_ENGINE_ENABLED` solo se respeta en `NODE_ENV=test` para pruebas internas controladas.
- En runtime normal (dev/prod), el motor CV permanece forzado a activo.
- El scoring principal puede usar imagen preprocesada, pero el rescate `panel_darkness_v1` debe ejecutarse sobre la foto original para no degradar detección de paneles derechos.
- Verificación local:
  - `npm -C apps/backend run omr:cv:smoke`
  - `npm -C apps/backend run omr:tv3:eval:synthetic`
  - `npm -C apps/backend run omr:tv3:build:por-folio-dataset`
  - `npm -C apps/backend run omr:tv3:validate:por-folio -- --dataset ../../omr_samples_tv3_real_por_folio`
  - `npm -C apps/backend run omr:tv3:diagnose:por-folio`
  - `npm -C apps/backend run omr:tv3:generate:real:manual-min`
  - `npm -C apps/backend run omr:tv3:validate:real:manual-min`

## Gate mixto (release)
- Gate sintético: `omr:tv3:eval:synthetic` (guardrail de regresión controlada).
- Gate real principal: `omr:tv3:validate:por-folio`.
- Dataset real principal: `omr_samples_tv3_real_por_folio/`.
- Gate real manual mínimo: `omr:tv3:validate:real:manual-min` como herramienta legacy de diagnóstico.
- El gate bloqueante en CI backend es `por-folio`.
- TV4 queda en estado `ready for validation`:
  - `omr:tv4:generate:synthetic`
  - `omr:tv4:eval:synthetic`
  - `omr:tv4:build:pilot-real`
  - `omr:tv4:validate:pilot-real`
  - `omr:tv4:diagnose:pilot-real`
- TV4 no debe declararse productivo ni reemplazar completamente a TV3 hasta que el piloto real pase.
- En `por-folio`, la cobertura se mide por preguntas resueltas:
  - respuesta marcada válida,
  - o resolución confiable de `blank` / `double`.
- El `failureReport` debe resumir solo causas de capturas no aprobadas, no advertencias benignas de páginas que ya pasaron.

## Troubleshooting rápido
- `falsePositiveRate` alto:
  - revisar prioridad de rescate `panel_darkness_v1` sobre falsos positivos geométricos.
  - revisar `OMR_RESPUESTA_CONF_MIN`, `OMR_SCORE_MIN`, `OMR_DELTA_MIN`.
- `autoGradeTrustRate` bajo:
  - revisar si `blank` / `double` correctos están contando como resolución válida.
  - revisar `OMR_AUTO_CONF_MIN`, `OMR_AUTO_AMBIGUAS_MAX`, `OMR_AUTO_DETECCION_MIN`.
- `autoCoverageRate < 1.0`:
  - revisar `estadoAnalisis`/policy de autocalificación y cobertura de preguntas resueltas por página.
- `fuera_roi` o errores geométricos:
  - revisar `OMR_ALIGN_RANGE`, `OMR_VERT_RANGE`, rescate de fiduciales y perfil de geometría.

## Recuperacion operativa
- Los examenes nuevos persisten:
  - `recoveryManifest` por examen
  - `recoveryBundle` por lote
- El backend expone recuperacion controlada para `admin` y `docente con plan` con permisos explicitos:
  - `GET /api/recuperacion/bundles`
  - `POST /api/recuperacion/verificar`
  - `POST /api/recuperacion/manifest/reconstruir`
  - `POST /api/recuperacion/bundle/reconstruir`
- Operacion local por CLI:
  - `npm -C apps/backend run recovery:bundles:list -- --actor-docente-id <id> --roles admin`
  - `npm -C apps/backend run recovery:verify -- --actor-docente-id <id> --manifest-hash <hash>`
  - `npm -C apps/backend run recovery:manifest:reconstruct -- --actor-docente-id <id> --manifest-hash <hash>`
  - `npm -C apps/backend run recovery:bundle:reconstruct -- --actor-docente-id <id> --bundle-hash <hash>`
- Politica de seguridad:
  - QR invalido detiene escaneo/calificacion.
  - `recoveryManifest` o `recoveryBundle` invalido detiene reconstruccion.
  - `keyId` es obligatorio en QR y artefactos de recovery.

## Nota
- Este README fue generado automáticamente como base; ampliar con decisiones de diseño específicas del módulo cuando aplique.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia tecnica del backend docente y sus contratos API.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../../../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../../../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
