# TV4 Pilot Real

Dataset del piloto real de TV4.

## Uso
- Coloca un manifest de importacion en `source/pilot_import.json` o usa `--source-manifest`.
- Ejecuta `npm -C apps/backend run omr:tv4:build:pilot-real`.
- El builder copiara imagenes y mapas, validara TV4 y generara `manifest.json`, `ground_truth.jsonl` y `answer_key.json`.

## Estado
- Si el dataset esta vacio, TV4 sigue en estado `ready for validation` y aun no puede declararse productivo.