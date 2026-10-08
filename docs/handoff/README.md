# Handoff IA

Este directorio centraliza la continuidad entre sesiones de agentes IA.

## Archivos
- `trace.schema.json`: contrato canonico machine-readable.
- `handoff.schema.json`: envelope compacto para transferencia entre proveedores.
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
- Envelope interoperable:
  - `npm run ia:handoff:envelope -- --input=<archivo.json>`
  - `npm run ia:handoff:validate`

## Notas
- El reporte generado no reemplaza la actualizacion de:
  - `docs/INVENTARIO_PROYECTO.md`
  - `docs/ENGINEERING_BASELINE.md`
  - `CHANGELOG.md`
- El contrato nuevo valida sesiones nuevas sin bloquear el historico markdown previo.
- El envelope no ejecuta comandos, usa rutas relativas, marca el contenido como no confiable
  y exige validacion antes de importarlo. A2A es el adaptador de red futuro; MCP permanece
  reservado para herramientas, recursos y datos.
