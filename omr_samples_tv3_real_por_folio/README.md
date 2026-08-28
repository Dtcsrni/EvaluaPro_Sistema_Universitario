# OMR TV4 Por Folio

Dataset real autocontenido derivado de `omr_samples_tv3/images/Por Folio`, promovido como baseline canonico TV4.

- `images/`: copias de las capturas originales.
- `maps/`: mapa OMR por captura derivado por deteccion de paneles laterales.
- `ground_truth.jsonl`: verdad de marcas por burbuja derivada con `panel_darkness_v1`.
- `answer_key.json`: clave correcta canonica del examen, no derivada de marcas estudiantiles.
- `source/`: snapshots usados para trazabilidad de folios, estructura PDF, mapeo canonico, reconciliacion y perfil de deteccion.

Regeneracion:

```bash
npm run omr:tv3:build:por-folio-dataset
```

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia local del modulo/carpeta dentro del monorepo.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-08-28.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
