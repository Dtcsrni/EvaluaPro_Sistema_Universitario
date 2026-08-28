# TV4 Pilot Real

Dataset del piloto real de TV4.

## Uso
- Coloca un manifest de importacion en `source/pilot_import.json` o usa `--source-manifest`.
- Ejecuta `npm -C apps/backend run omr:tv4:build:pilot-real`.
- El builder copiara imagenes y mapas, validara TV4 y generara `manifest.json`, `ground_truth.jsonl` y `answer_key.json`.

## Estado
- Si el dataset esta vacio, TV4 sigue en estado `ready for validation` y aun no puede declararse productivo.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia local del modulo/carpeta dentro del monorepo.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-08-28.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
