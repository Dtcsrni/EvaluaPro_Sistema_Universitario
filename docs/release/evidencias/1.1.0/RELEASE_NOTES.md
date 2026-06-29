# EvaluaPro 1.1.0 - Evidencia candidata

Estado: Go estable con QA automatizada de UX/UI y flujo docente.

## Cambios relevantes
- Hidratacion de curso iniciado desde XLSX/DOCX con alumnos, calificaciones historicas y banco de preguntas desde parciales/globales con clave detectable.
- Experiencia Classroom mejorada con busqueda en roster y submissions para operar grupos grandes.
- Diff coverage ajustado para evaluar `HEAD..WORKTREE` en cambios locales sin arrastrar merges previos.
- Gate de release estable endurecido: bloquea instaladores sin firma, exige `name/path/sha256` por artefacto, `installer:sign` regenera hashes/manifest despues de firmar y exige evidencia QA automatizada en `reports/qa/latest/manifest.json`.

## Validacion local
- `npm run test:ci`
- `npm run test:coverage:ci`
- `npm run test:tdd:enforcement:ci`
- `npm run test:classroom:audit:ci`
- `npm run qa:full`
- `npm run perf:check`
- `npm run ci:policy:audit`

## Pendiente operativo no bloqueante
- Ejecutar smoke humano productivo y Classroom real si se desea evidencia manual adicional.
- Sustituir certificado interno local por certificado de codigo publico si el canal stable requiere confianza publica de Windows.
- Publicar tag/release estable desde un commit limpio con estos cambios.
