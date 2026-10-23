# Versionado y releases

EvaluaPro usa versiones SemVer (`MAJOR.MINOR.PATCH`). La versión del repositorio, el tag de Git, la release pública y la versión instalada son estados diferentes; no se deben inferir unos de otros.

## Versiones independientes

- EvaluaPro (aplicación): `config/app-version.json` y versiones de paquetes/lockfiles. Se etiqueta `app-vX.Y.Z`; esas tags activan la publicación de imágenes Docker.
- Installer Hub: `config/hub-version.json`. Se etiqueta `hub-vX.Y.Z`; esas tags activan el build y la release del instalador Windows.
- Las versiones beta de la aplicación usan `app-vX.Y.Z-beta.N`.
- El MSI informa la versión de la aplicación; el bundle Burn y la GUI del Hub informan la versión del Hub. El manifiesto del instalador registra ambas (`appVersion` y `hubVersion`).
- Corte verificado el 2026-10-22: GitHub publicó `hub-v1.2.10` desde `95219caa731eff7c1b079be6580292b804132447`; el código fuente declara aplicación `1.2.9` y Hub `1.2.10`. No reutilices esos números para un payload distinto.
- Según ese corte, el siguiente candidato es Hub `1.2.11` sobre aplicación `1.2.9`, a menos que se publique otra versión antes de prepararlo. Reconsulta GitHub y actualiza `config/hub-version.json`, changelog y manifiesto antes de crear el tag.
- La versión instalada solo se confirma desde EvaluaPro en el equipo.

## Fuentes de versión

- Versión de producto y runtime: `config/app-version.json`, paquetes y lockfiles de raíz y workspaces.
- Versión del Installer Hub: `config/hub-version.json`.
- Registro de cambios: `CHANGELOG.md`.
- Artefacto instalado y su checksum: página y manifiesto de la release correspondiente.

## Promoción a release estable

Una versión solo se describe como pública o estable cuando su release aparece publicada en GitHub y los gates del repositorio confirman el artefacto esperado. La integración en `main`, un tag, un borrador de release o un EXE local no satisfacen por sí solos esa condición.

El flujo de release debe verificar:

1. Estado y versión Hub de `main`, tag `hub-vX.Y.Z` y manifiesto que separa Hub y aplicación.
2. Checksums de instalador y archivos publicados.
3. E2E del instalador descargado desde la release, incluyendo actualización y conservación de datos en un entorno aislado.
4. E2E real de Google Classroom, con evidencia para la misma versión candidata; fixtures y mocks no satisfacen este requisito.
5. Gates de CI y políticas aplicables al cambio.
6. Publicación final y disponibilidad de la release y sus assets desde GitHub.

Consulta [estado de releases](RELEASE_STATUS.md), [política de tags](TAGGING_POLICY.md), [release gate estable](RELEASE_GATE_STABLE.md) y [changelog](../CHANGELOG.md).

## Compatibilidad

- No reutilices un número de versión para un payload diferente.
- Los prereleases llevan sufijo (`-alpha`, `-beta`, `-rc`) y no se presentan como una release estable.
- Si cambia el contrato de datos, instalador o actualizador, documenta el efecto en notas y evidencias de release.
- Las actualizaciones no sustituyen un respaldo previo de los datos docentes.
