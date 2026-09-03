# Runbook OMR canónico

## Objetivo

Ejecutar y validar la única plantilla OMR soportada por EvaluaPro, desde la generación del PDF hasta la calificación automática.

## Prerrequisitos

- Node 24.
- Dependencias instaladas (`npm ci`).
- Backend CV operativo (`npm -C apps/backend run omr:cv:smoke`).
- Dataset sintético vigente: `omr_samples_tv4/`.
- Piloto de captura real: `omr_samples_tv4_pilot_real/`.

## Flujo operativo

Generar y evaluar el dataset sintético:

```bash
npm -C apps/backend run omr:generate:synthetic
npm -C apps/backend run omr:eval:synthetic
```

Preparar o validar el piloto real:

```bash
npm -C apps/backend run omr:build:pilot-real
npm -C apps/backend run omr:validate:pilot-real
npm -C apps/backend run omr:diagnose:pilot-real
```

Ejecutar el gate bloqueante de CI:

```bash
npm run test:omr:canonical:gate:ci
```

## Evidencia generada

- `reports/qa/latest/omr/canonical-synthetic-eval.json`
- `reports/qa/latest/omr/canonical-pilot-real-validation.json`
- `reports/qa/latest/omr/canonical-pilot-real-failures.json`
- `reports/qa/latest/omr-canonical-gate-wrapper.json`

## Dataset de captura real

El piloto vigente conserva `manifest.json`, mapas y verdad esperada. Para incorporar capturas reales, agrega imágenes con el mismo `captureId`, actualiza la verdad de marcas y ejecuta nuevamente el gate canónico. Un dataset sin capturas no puede declararse validado en condiciones reales.

## Checklist de liberación

- Smoke CV aprobado.
- Gate sintético aprobado.
- Gate de captura real aprobado con imágenes y ground truth reales.
- `autoCoverageRate == 1.0`.
- Sin regresiones en las pruebas OMR/PDF críticas.
- No existen rutas de compatibilidad ni datasets de versiones anteriores.

## Troubleshooting

- `falsePositiveRate` alto: revisar `OMR_RESPUESTA_CONF_MIN`, `OMR_SCORE_MIN` y `OMR_DELTA_MIN`.
- `autoGradeTrustRate` bajo: revisar `OMR_AUTO_CONF_MIN`, `OMR_AUTO_AMBIGUAS_MAX` y `OMR_AUTO_DETECCION_MIN`.
- `autoCoverageRate < 1.0`: revisar calidad, geometría y páginas con mayor número de mismatches; no forzar páginas en producción.
- `fuera_roi` o errores geométricos: revisar fiduciales, `OMR_ALIGN_RANGE`, `OMR_VERT_RANGE` y el perfil geométrico activo.
