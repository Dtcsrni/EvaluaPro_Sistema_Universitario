# OMR TV3 Por Folio

Dataset real autocontenido derivado de `omr_samples_tv3/images/Por Folio`.

- `images/`: copias de las capturas originales.
- `maps/`: mapa OMR por captura derivado por deteccion de paneles laterales.
- `ground_truth.jsonl`: truth por burbuja derivado con `panel_darkness_v1`.
- `source/`: snapshots usados para trazabilidad de folios y perfil de deteccion.

Regeneracion:

```bash
npm run omr:tv3:build:por-folio-dataset
```
