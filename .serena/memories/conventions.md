# Conventions
- Codigo y docs usan espanol tecnico; nombres de variables/funciones en `camelCase`; paths HTTP suelen usar `kebab-case`.
- Backend: rutas/controladores/validaciones por modulo; validar payload con Zod y `validarCuerpo`; errores por `ErrorAplicacion` y middleware central.
- Router backend mantiene rutas publicas de salud/autenticacion antes de `requerirDocente`; resto protegido y con permisos por accion.
- Cambios deben ser minimos; no bajar thresholds ni ocultar deuda para pasar gates.
- Docs, diagramas, baseline, handoff y changelog forman parte de trazabilidad cuando hay cambios de sesion/corte.
- Caveman y Serena son obligatorios en sesiones de agentes de este repo.