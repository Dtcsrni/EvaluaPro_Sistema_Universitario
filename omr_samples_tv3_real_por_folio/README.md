# OMR TV3 Por Folio

Dataset real autocontenido derivado de `omr_samples_tv3/images/Por Folio`.

- `images/`: copias de las capturas originales.
- `maps/`: mapa OMR por captura derivado por deteccion de paneles laterales.
- `ground_truth.jsonl`: verdad de marcas por burbuja derivada con `panel_darkness_v1`.
- `answer_key.json`: clave correcta canonica del examen, no derivada de marcas estudiantiles.
- `source/`: snapshots usados para trazabilidad de folios, estructura PDF, mapeo canonico, reconciliacion y perfil de deteccion.

Regeneracion:

```bash
npm run omr:tv3:build:por-folio-dataset
```
