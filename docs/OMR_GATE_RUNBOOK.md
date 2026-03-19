# Runbook OMR Por Folio Gate

## Objetivo
Ejecutar y validar el gate mixto de confiabilidad OMR TV4 con baseline real `Por Folio` para liberar autocalificacion con evidencia trazable.

## Prerrequisitos
- Node 24.
- Dependencias instaladas (`npm ci`).
- Backend CV operativo (`npm -C apps/backend run omr:cv:smoke`).
- Dataset real `Por Folio` disponible en `omr_samples_tv3_real_por_folio/`.
- Dataset real manual mínimo disponible en `omr_samples_tv3_real_manual_min/`.

## Flujo operativo
1. Generar/actualizar dataset real `Por Folio`:
```bash
npm -C apps/backend run omr:tv3:build:por-folio-dataset
```
El nombre del script es legacy, pero la salida regenerada debe quedar en contrato TV4.

2. Generar/actualizar dataset real manual mínimo:
```bash
npm -C apps/backend run omr:tv3:generate:real:manual-min
```

3. Ejecutar gate sintético:
```bash
npm -C apps/backend run omr:tv3:eval:synthetic
```

4. Ejecutar gate real `Por Folio`:
```bash
npm -C apps/backend run omr:tv3:validate:por-folio -- --dataset ../../omr_samples_tv3_real_por_folio
```

5. Ejecutar diagnóstico reproducible del lote `Por Folio`:
```bash
npm -C apps/backend run omr:tv3:diagnose:por-folio
```

6. Ejecutar gate real manual mínimo legado:
```bash
npm -C apps/backend run omr:tv3:validate:real:manual-min
```

7. Capturar baseline reproducible:
```bash
npm -C apps/backend run omr:tv3:baseline:snapshot -- --dataset-real-manual ../../omr_samples_tv3_real_manual_min
```

8. Ejecutar calibración iterativa (solo si falla algún gate):
```bash
npm -C apps/backend run omr:tv3:calibrate:real
```

## Evidencia generada
- `reports/qa/latest/omr/baseline_snapshot.json`
- `reports/qa/latest/omr/synthetic-eval*.json`
- `reports/qa/latest/omr/tv3-por-folio-validation*.json`
- `reports/qa/latest/omr/tv3-por-folio-failures*.json`
Los nombres de artefacto se conservan por compatibilidad histórica aunque el baseline nominal sea TV4.
- `reports/qa/latest/omr/por-folio-diagnose/*`
- `reports/qa/latest/omr/tv3-real-manual-validation*.json`
- `reports/qa/latest/omr/tv3-real-manual-failure-analysis*.json`
- `omr_samples_tv3_real_por_folio/*`
- `reports/qa/latest/omr/real_manual_dataset_generation_report.json`
- `reports/qa/latest/omr/calibration_iterations.json`
- `reports/qa/latest/omr/calibration_decision.md`

## Dataset manual mínimo (captura móvil)
- Base reproducible actual: `omr_samples_tv3_real_manual_min` generado con simulación móvil.
- Para operar con captura real:
  - conservar `maps/*`, `manifest.json` y `ground_truth.jsonl`
  - reemplazar solo `images/*` por fotos reales de móvil (mismo `captureId`)
  - volver a ejecutar `npm -C apps/backend run omr:tv3:validate:real:manual-min`

## Checklist de liberación
- Smoke CV `ok`.
- Gate sintético `ok`.
- Gate real `Por Folio` `ok`.
- Gate real manual mínimo se usa solo como diagnóstico legado.
- `autoCoverageRate == 1.0` en el gate `Por Folio`.
- Sin regresión en tests OMR críticos.
- Artefactos OMR publicados en CI backend.

## Troubleshooting
- `falsePositiveRate` alto:
  - subir `OMR_RESPUESTA_CONF_MIN`
  - subir `OMR_SCORE_MIN`
  - subir `OMR_DELTA_MIN`
- `autoGradeTrustRate` bajo:
  - ajustar `OMR_AUTO_CONF_MIN`
  - reducir `OMR_AUTO_AMBIGUAS_MAX`
  - subir `OMR_AUTO_DETECCION_MIN`
- `autoCoverageRate < 1.0`:
  - NO forzar páginas por defecto; mantener `OMR_AUTO_FORCE_ALL_PAGES=0`
  - usar `OMR_AUTO_FORCE_ALL_PAGES=1` solo en diagnóstico controlado (nunca en producción)
  - revisar páginas con `mismatches` altos en `tv3-real-*-failure-analysis.json`
- `fuera_roi`/geometría:
  - revisar `reports/qa/latest/omr/por-folio-diagnose/*`
  - revisar perfil geométrico y umbrales `OMR_ALIGN_RANGE`/`OMR_VERT_RANGE`.
