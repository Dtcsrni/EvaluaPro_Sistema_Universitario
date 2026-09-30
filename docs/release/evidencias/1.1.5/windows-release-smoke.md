# Evidencia Windows — EvaluaPro 1.1.5

Fecha: `2026-09-15`
Versión: `1.1.5`
Commit: `157229e09e341c69a2fd897cfcc0c6096a0ebda3`

## Validación local

- `npm run publish:docente:experimental` completó la sincronización del bundle docente y sus mirrors.
- El backend compilado y su `package.json` de versión `1.1.5` fueron sincronizados con la instalación local.
- La aplicación local se relanzó desde `C:\Users\evega\AppData\Local\EvaluaPro\EvaluaPro.exe`.
- `http://localhost:4173/` respondió `200`.
- `http://localhost:4000/api/salud/` respondió `200`.
- El build local `docente-local` produjo un bundle con `FileVersion 1.1.5.0`, `ProductVersion 1.1.5.0` y manifest de commit final.

## Validación CI y publicación

- `CI Installer Windows`, run `34983313354`/`#184`: `success` sobre el commit final.
- El release público `v1.1.5` conserva únicamente los assets de esa versión.
- El manifest público reporta `version=1.1.5`, `channel=stable` y el commit `157229e09e341c69a2fd897cfcc0c6096a0ebda3`.
- El checksum publicado se conserva como la integridad del binario descargable de CI; el build local se documenta por separado porque su SHA-256 no es idéntico entre entornos.

## Alcance y límite

La aplicación local quedó verificada en sus endpoints de salud y artefactos de instalación. No se declara aquí un flujo humano productivo externo, porque no se ejecutó con credenciales ni datos productivos en esta sesión.

