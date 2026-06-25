# Handoff IA

Este directorio centraliza la continuidad entre sesiones de agentes IA.

## Archivos
- `trace.schema.json`: contrato canonico machine-readable.
- `CONTRATO_TRAZABILIDAD_IA.md`: guia corta del contrato.
- `PLANTILLA_HANDOFF_IA.md`: formato humano alineado al schema.
- `sesiones/<YYYY-MM-DD>/<sesion>.json`: evidencia canonica de sesion.
- `sesiones/<YYYY-MM-DD>/<sesion>.md`: render humano del mismo contrato.

## Generacion automatica
- Modo rapido (recomendado por sesion):
  - `npm run ia:handoff:quick`
- Modo completo (incluye gates pesados):
  - `npm run ia:handoff:full`
- Input enriquecido opcional:
  - `node scripts/ia-handoff.mjs --mode quick --input <archivo.json>`

## Notas
- El reporte generado no reemplaza la actualizacion de:
  - `docs/INVENTARIO_PROYECTO.md`
  - `docs/ENGINEERING_BASELINE.md`
  - `CHANGELOG.md`
- El contrato nuevo valida sesiones nuevas sin bloquear el historico markdown previo.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Documentacion funcional/operativa para despliegue, seguridad y cumplimiento.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-06-23.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
