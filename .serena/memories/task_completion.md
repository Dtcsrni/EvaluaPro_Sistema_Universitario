# Task completion
- Gates minimos antes de cerrar cambios segun `AGENTS.md`: `npm run lint`, `npm run typecheck`, `npm run test:frontend:ci`, `npm run test:coverage:ci`, `npm run test:tdd:enforcement:ci`, `npm run test:backend:ci`, `npm run test:portal:ci`, `npm run perf:check`, `npm run pipeline:contract:check`.
- Si alcance estructural/Big Bang: agregar `npm run qa:clean-architecture:strict` y `npm run ci:policy:audit`.
- Cada sesion con cambios debe actualizar `docs/INVENTARIO_PROYECTO.md`, `docs/ENGINEERING_BASELINE.md`, `CHANGELOG.md`, generar `npm run ia:handoff:quick` y `npm run inventario:codigo` segun politica repo.
- Si un gate no aplica por alcance, reportar justificacion explicita.