# Política de tags y releases

EvaluaPro mantiene tags independientes para la aplicación y el Installer Hub:

- Aplicación: `app-vX.Y.Z`; sus tags activan la publicación de imágenes Docker.
- Installer Hub: `hub-vX.Y.Z`; sus tags activan el build y la release del instalador Windows.
- Las prereleases usan el sufijo correspondiente (`-alpha.N`, `-beta.N` o `-rc.N`) y nunca se presentan como estables.

No se permiten aliases, tags reubicados ni versiones estables creadas manualmente. Cada tag debe apuntar a un commit inmutable y tener una release GitHub asociada al workflow correspondiente. Nunca reutilices un número de versión para otro payload.

## Promoción

1. El trabajo normal vive en ramas `codex/*`, `fix/*` o `feature/*`.
2. La validación previa usa una prerelease.
3. La tag estable solo se crea después de que pasen las gates aplicables, incluida firma, hash, payload nativo, UX/UI interactiva, E2E de instalación/reparación/actualización/desinstalación y ramas sincronizadas.
4. La promoción estable de EvaluaPro requiere también evidencia de E2E real con Google Classroom para la misma versión candidata. Mocks o fixtures no satisfacen este requisito.
5. La página de la release debe contener los assets esperados, checksum y manifiesto. La publicación y la instalación del artefacto se verifican antes de describirlo como estable.
6. Si una tag no coincide con el formato y las reglas del repositorio, el guard correspondiente debe rechazarla; no muevas una tag publicada para corregirla.

## Estado conocido

Al corte del 2026-10-22, GitHub mostraba `hub-v1.2.10` como la release pública más reciente. Esa release se publicó antes de que la evidencia Classroom real fuera requisito obligatorio en la gate; no demuestra por sí misma que esa condición se cumpliera. Consulta [GitHub Releases](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases) y [Estado de releases](RELEASE_STATUS.md) para el estado actual. No asumas que el estado de este corte sigue vigente.
