# Versionado y releases

EvaluaPro usa versiones SemVer (`MAJOR.MINOR.PATCH`). La versión del repositorio, el tag de Git, la release pública y la versión instalada son estados diferentes; no se deben inferir unos de otros.

## Estado observado

- Código integrado en `main`: `1.2.6`, según `config/app-version.json` en este corte.
- Última release pública observada el 2026-10-08: `v1.2.5`, según [GitHub Releases/latest](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest).
- `v1.2.6` estaba en borrador en ese corte; no se trata como descarga pública.
- La versión instalada solo se confirma desde EvaluaPro en el equipo.
- El perfil considerado para distribución es `docente-local` en Windows.

En este corte, `v1.2.6` aparece como borrador, no como release pública. Estos datos pueden cambiar al publicar otra release. Antes de instalar, confirma el tag, el asset del instalador y el checksum en GitHub.

## Fuentes de versión

- Versión de producto: `config/app-version.json`.
- Versiones de paquetes y lockfiles: raíz y workspaces; actualizarlas con los scripts oficiales del repositorio.
- Registro de cambios: `CHANGELOG.md`.
- Artefacto instalado y su checksum: página y manifiesto de la release correspondiente.

## Promoción a release estable

Una versión solo se describe como pública o estable cuando su release aparece publicada en GitHub y los gates del repositorio confirman el artefacto esperado. La integración en `main`, un tag, un borrador de release o un EXE local no satisfacen por sí solos esa condición.

El flujo de release debe verificar:

1. Estado y versión de `main`, tag y manifiesto del artefacto.
2. Checksums de instalador y archivos publicados.
3. E2E del instalador descargado desde la release, incluyendo actualización y conservación de datos en un entorno aislado.
4. Gates de CI y políticas aplicables al cambio.
5. Publicación final y disponibilidad de la release y sus assets desde GitHub.

Consulta [estado de releases](RELEASE_STATUS.md), [release gate estable](RELEASE_GATE_STABLE.md) y [changelog](../CHANGELOG.md).

## Compatibilidad

- No reutilices un número de versión para un payload diferente.
- Los prereleases llevan sufijo (`-alpha`, `-beta`, `-rc`) y no se presentan como una release estable.
- Si cambia el contrato de datos, instalador o actualizador, documenta el efecto en notas y evidencias de release.
- Las actualizaciones no sustituyen un respaldo previo de los datos docentes.
