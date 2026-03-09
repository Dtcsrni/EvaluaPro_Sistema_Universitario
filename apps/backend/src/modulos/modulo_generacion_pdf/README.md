# Modulo de Generacion de PDF

Estado actual: motor unico moderno con compatibilidad multi-plantilla TV3/TV4 sobre rutas canonicas `/api/examenes/*`.

## Arquitectura

Estructura:

```
modulo_generacion_pdf/
|- application/usecases/
|- domain/
|- infra/
|- shared/
|- controladorGeneracionPdf.ts
|- servicioGeneracionPdf.ts
```

Principios activos:
- Sin feature flags de adopcion.
- Sin motor paralelo antiguo.
- Compatibilidad multi-plantilla con contrato versionado de layout/paginacion.
- Sin compatibilidad de `totalReactivos` en modulo PDF.
- Politica actual de generacion:
  - `templateVersion` soportado: TV3 y TV4.
  - default tecnico actual: TV4.
  - preguntas normalizadas a 5 opciones para mapas OMR TV3/TV4.
  - preguntas con mas de 5 opciones se rechazan (422).
- Generacion desacoplada de alumno:
  - el examen se genera sin `alumnoId` asociado.
  - la vinculacion examen-alumno se realiza en recepcion/entrega.
  - el PDF incluye campos manuales amplios para `Nombre del alumno` y `Grupo`.
- Recuperacion operativa:
  - cada examen persiste `recoveryManifest`.
  - cada lote persiste `recoveryBundle`.
  - ambos artefactos se firman y permiten reconstruccion aunque se pierda informacion del docente.

## Contrato operativo

- Crear/editar plantilla: `POST /api/examenes/plantillas` y `POST /api/examenes/plantillas/:id`
- Generar examen: `POST /api/examenes/generados`
- Previsualizar: `GET /api/examenes/plantillas/:id/previsualizar`
- Previsualizar PDF: `GET /api/examenes/plantillas/:id/previsualizar/pdf`

## Variables de entorno

- `EXAMEN_LAYOUT_VERSION=3`
- `EXAMEN_LAYOUT_CONFIGURACION='{}'`
- `OMR_QR_HMAC_SECRET`
- `OMR_QR_RECOVERY_SECRET`

## Validacion recomendada

```bash
npm run lint
npm run typecheck
npm -C apps/backend run test -- tests/integracion/pdfImpresionContrato.test.ts
npm -C apps/backend run omr:tv4:generate:synthetic
npm -C apps/backend run omr:tv4:eval:synthetic
npm -C apps/backend run omr:tv4:build:pilot-real
npm run qa:clean-architecture:strict
```

## Estado de TV4

- TV4 ya esta integrado en generacion y compatibilidad de escaneo.
- El dataset sintetico TV4 debe pasar antes de release.
- El piloto real TV4 sigue en estado `ready for validation` hasta que exista dataset real importado y pase:
  - `omr:tv4:validate:pilot-real`
  - `omr:tv4:diagnose:pilot-real`
- El builder del piloto real espera un manifest de importacion en:
  - `omr_samples_tv4_pilot_real/source/pilot_import.json`
  - o `--source-manifest <ruta>`

## Referencias

- `docs/ENGINEERING_BASELINE.md`
- `docs/INVENTARIO_PROYECTO.md`
- `scripts/clean-architecture-check.mjs`

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia tecnica del backend docente y sus contratos API.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../../../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../../../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
