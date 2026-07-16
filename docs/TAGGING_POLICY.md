# Política de tags y releases

EvaluaPro no tiene una release vigente mientras el E2E nativo `docente-local`
no esté completamente verde.

## Formato único

- Estable: `vMAJOR.MINOR.PATCH`
- Prerelease: `vMAJOR.MINOR.PATCH-alpha.N`, `vMAJOR.MINOR.PATCH-beta.N` o
  `vMAJOR.MINOR.PATCH-rc.N`

No se permiten tags libres, aliases, tags reubicados ni versiones estables
creadas manualmente. Cada tag debe apuntar a un commit inmutable y tener una
release GitHub asociada por el workflow.

## Promoción

1. El trabajo normal vive en ramas `codex/*`, `fix/*` o `feature/*`.
2. La validación previa usa prerelease `beta` o `rc`.
3. La tag estable solo se crea después de la gate completa: firma, hash,
   payload nativo, UX/UI interactiva, E2E instalar/reparar/actualizar/
   desinstalar y ramas sincronizadas.
4. Si la tag no coincide con el formato, el guard la elimina automáticamente.

El estado actual es deliberadamente **sin tags ni releases**.
