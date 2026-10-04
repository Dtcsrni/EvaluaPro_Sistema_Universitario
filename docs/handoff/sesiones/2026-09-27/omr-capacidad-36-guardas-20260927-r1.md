# Handoff IA - Sesión

- traceSchemaVersion: 1.0.0
- sessionId: omr-capacidad-36-guardas-20260927-r1
- parentSessionId: -
- status: final
- generatedAt: 2026-09-27T21:54:48Z
- validationProfile: quick

## Objetivo

Proteger la capacidad de 35 reactivos breves en dos caras sin degradar OMR/QR y validar la respuesta del layout para 36 reactivos.

## Resultado

- 35 reactivos se mantienen en 2 páginas (17+18).
- 36 reactivos producen 3 páginas (17+18+1) bajo la separación OMR validada.
- Un ensayo de 18+18 redujo la separación etiqueta-borde por debajo de la guarda >2.39 pt y se descartó; no se conserva ese cambio de producción.
- Las pruebas focales de capacidad pasaron 2/2; pruebas QR/preimpresión 16/16.
- ESLint focal pasó; trazabilidad 7/7 y handoff 11/11.
- `npm run sdd:audit` falló por un test inexistente declarado por SPEC-070 (`apps/backend/tests/integracion/codigosAccesoApi.test.ts`); SPEC-062 aparece válida.
- La regresión verifica geometría OMR, colisiones, numeración continua y decodificación exacta del QR de cada página tras raster JPEG degradado.

## Archivos

- `apps/backend/tests/pdf.layout.visual.guard.test.ts`
- `docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md`

## Riesgos y siguiente paso

La medida aplica solo a reactivos sintéticos breves, no equivale a fotos reales ni a impresión física. Investigar alternativas de composición/cabecera sin tocar diámetro/paso OMR, legibilidad de etiquetas, fiduciales o QR; añadir un guard de alineación vertical entre texto y panel por reactivo. Resolver aparte la referencia de test ausente en SPEC-070 para recuperar el gate SDD global.
