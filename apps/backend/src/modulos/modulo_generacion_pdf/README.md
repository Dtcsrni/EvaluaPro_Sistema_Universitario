# Modulo de Generacion de PDF

Estado actual: motor unico moderno TV3 sobre rutas canonicas `/api/examenes/*`.

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
- Contrato unico para layout/paginacion TV3.
- Sin compatibilidad de `totalReactivos` en modulo PDF.
- Compatibilidad TV3 estricta en generacion:
  - `templateVersion` fijo a TV3.
  - preguntas normalizadas a 5 opciones para mapa OMR TV3.
  - preguntas con mas de 5 opciones se rechazan (422).
- Generacion desacoplada de alumno:
  - el examen se genera sin `alumnoId` asociado.
  - la vinculacion examen-alumno se realiza en recepcion/entrega.
  - el PDF incluye campos manuales amplios para `Nombre del alumno` y `Grupo`.

## Contrato operativo

- Crear/editar plantilla: `POST /api/examenes/plantillas` y `POST /api/examenes/plantillas/:id`
- Generar examen: `POST /api/examenes/generados`
- Previsualizar: `GET /api/examenes/plantillas/:id/previsualizar`
- Previsualizar PDF: `GET /api/examenes/plantillas/:id/previsualizar/pdf`

## Variables de entorno

- `EXAMEN_LAYOUT_VERSION=3`
- `EXAMEN_LAYOUT_CONFIGURACION='{}'`

## Validacion recomendada

```bash
npm run lint
npm run typecheck
npm -C apps/backend run test -- tests/integracion/pdfImpresionContrato.test.ts
npm run qa:clean-architecture:strict
```

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
