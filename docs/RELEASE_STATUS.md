# Estado de releases

## Corte verificado: 2026-10-22

- La release pública más reciente consultada en GitHub es `hub-v1.2.10`, publicada el 2026-10-22 y apuntando al commit `95219caa731eff7c1b079be6580292b804132447`.
- La release incluye `EvaluaPro-InstallerHub-docente-local-v1.2.10.exe`, su checksum SHA-256 (`b89f0bfe427b0e8ac0ac4c5742dab718cfcd327ceb0cfb4b001a5d11b9a8864e`) y `EvaluaPro-release-manifest.json`.
- En el `main` consultado, la aplicación es `1.2.9` y el Installer Hub es `1.2.10`. Son versiones independientes.
- La corrección que hace obligatorio el E2E real de Google Classroom se integró después de esa publicación, en el commit `7c28da1bda182c9d75ad53530ad6afeb379be1bc`. Por tanto, `hub-v1.2.10` no acredita que se haya aplicado esa nueva gate ni debe citarse como evidencia de ella.
- El siguiente candidato Hub debe usar una versión inédita; según el estado consultado, corresponde `hub-v1.2.11` sobre la aplicación `1.2.9`, salvo que aparezca una versión más reciente antes de prepararlo. Reconsulta GitHub y actualiza el manifiesto antes de etiquetar.

## Qué cuenta como release completa

La existencia de una versión en `main`, un tag, un borrador o un EXE local no basta para declarar una promoción estable. Verifica:

1. Los workflows requeridos del commit de release terminan satisfactoriamente.
2. La release pública contiene el instalador `docente-local`, su checksum y manifiesto.
3. Se descarga el instalador desde la página pública, se valida el checksum y se ejecuta la E2E completa de instalación y actualización en un entorno aislado.
4. La E2E confirma arranque, funciones docentes básicas, actualización a la versión nueva y conservación de datos de prueba.
5. La evidencia manual requerida de Classroom acredita el E2E real y corresponde a la versión candidata; los mocks no cuentan como conexión con Google.
6. El resultado, SHA, asset y log resumido quedan registrados en `docs/release/evidencias/<versión>/`.

## Referencias de fuente de verdad

- [Versionado](VERSIONADO.md) distingue código, tags, releases e instalación.
- [Política de tags y releases](TAGGING_POLICY.md) define el formato y la promoción.
- [Release gate estable](RELEASE_GATE_STABLE.md) define los contratos de promoción.
- [Changelog](../CHANGELOG.md) describe el contenido del código.
- [Releases de GitHub](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases) muestra lo realmente publicado.
- `docs/release/evidencias/` conserva resultados como evidencia histórica.

Las evidencias históricas no prueban el estado de una release posterior. No infieras integridad, firma, actualización o aprobación de un asset a partir del tag o del número de versión. Revisa la release pública antes de iniciar una instalación.
