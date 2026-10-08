# Estado de releases

## Corte documentado: 2026-10-08

- La versión fuente integrada en `main` es `1.2.6` (`config/app-version.json`).
- GitHub Releases/latest mostró `v1.2.5` al consultar la página pública el 2026-10-08.
- `v1.2.6` aparece como borrador con assets; no se presenta como release pública ni como descarga vigente. Consulta [Releases/latest](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest) antes de instalar y vuelve a comprobar este documento después de una publicación.
- El alcance de distribución mantenido es `docente-local` para Windows. No habilites ni anuncies otros perfiles por este documento.

## Qué cuenta como release completa

La release no se considera lista solo porque exista una versión en `main`, un tag o un borrador. Para cerrar una promoción estable:

1. Los workflows requeridos del commit de release terminan en estado satisfactorio.
2. La release pública contiene el instalador `docente-local`, su checksum y manifiesto.
3. Se descarga el instalador desde la página pública, se valida su checksum y se ejecuta la E2E completa de instalación y actualización en un entorno aislado.
4. La E2E confirma arranque, funciones docentes básicas, actualización a la versión nueva y conservación de datos de prueba.
5. El resultado, SHA, asset y log resumido quedan registrados en `docs/release/evidencias/<versión>/`.

## Referencias de fuente de verdad

- [Versionado](VERSIONADO.md) describe cómo distinguir código, tag, release e instalación.
- [Release gate estable](RELEASE_GATE_STABLE.md) define los contratos de promoción.
- [Changelog](../CHANGELOG.md) describe el contenido del código.
- [Releases de GitHub](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases) muestra lo que está realmente publicado.
- `docs/release/evidencias/` conserva los resultados de ejecuciones previas como evidencia histórica.

Las evidencias históricas no prueban el estado de una release posterior. No infieras integridad, firma, actualización o aprobación de un asset a partir del tag o del número de versión.
