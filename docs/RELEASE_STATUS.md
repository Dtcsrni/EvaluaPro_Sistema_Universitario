# Estado de releases

## Estado actual

EvaluaPro no tiene actualmente una versión estable publicada.

Las releases estables históricas y sus tags (`v1.0.0`, `v1.0.1`, `v1.0.2`,
`v1.1.0` y `v1.1.1`) fueron retiradas porque el flujo `docente-local` aún no
ha demostrado un ciclo E2E completo y reproducible en PC nativa.

El trabajo activo se valida como QA local. No debe descargarse ni presentarse
ningún artefacto QA como release estable ni prerelease publicado.

El repositorio está deliberadamente sin tags y sin releases publicados hasta
que el esquema nuevo y el E2E completo estén listos.

## Criterio para la próxima estable

Solo se podrá crear una nueva tag/release estable cuando exista evidencia de:

- bundle firmado y hash coincidente;
- gate de payload nativo SQLite verde;
- UX/UI interactiva completa con capturas y estados esperados;
- ciclo `instalar -> datos dummy -> reparar -> actualizar -> desinstalar` verde;
- gates contractuales y de seguridad verdes;
- ramas de release sincronizadas.
