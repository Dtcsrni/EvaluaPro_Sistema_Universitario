# SPEC-101: padre privado de reportes en CI

## Objetivo

Continuar el E2E de upgrade de EvaluaPro 1.2.8 sin publicar una release. El run #649 falló correctamente antes de instalar porque el reporte se preparaba dentro de `RUNNER_TEMP` (`D:\a\_temp`), cuyo ACL permite escritura a `BUILTIN\Users`.

## Cambio realizado

- Los tres flujos de Installer CI (workflow dispatch, release draft y release público) ahora calculan una sola ruta de reporte bajo `USERPROFILE`.
- El nombre incluye `run_id` y `run_attempt`, por lo que cada reintento obtiene un directorio distinto.
- Tanto el runner E2E como `upload-artifact` reciben la misma ruta calculada.
- Se conserva el guard ACL existente, que debe validar el directorio y fallar cerrado ante permisos amplios.
- SPEC-101 pasa de 1.1.0 a 1.1.1; el test de contrato impide regresar a `RUNNER_TEMP`.

## Validación local

| Comando | Resultado |
| --- | --- |
| `node --test scripts/tests/installer-upgrade-e2e-contract.test.mjs` | 20/20 aprobadas |
| `npm run test:installer-hub:contract` | 147 aprobadas, 13 omitidas, 0 fallos |
| `npm run pipeline:contract:check` | 42/42 aprobadas |
| `npm run sdd:audit` | Correcto |
| `npm run ci:policy:audit` | Correcto |

## Estado E2E y restricciones

El run #649 ya validó build, bundle, antivirus y descarga/hash del baseline 1.2.3. Falló en la verificación del padre del reporte antes del paso de instalación y no generó artefactos. La corrección actual aún necesita ejecutarse en Actions. No se ha confirmado instalación, upgrade, repair, uninstall ni evidencia UX/UI del fix.

No se creó tag ni se publicó una release. La siguiente ejecución debe usar `source_sha` igual al `HEAD` de `main` y `release_tag` vacío. Si termina correctamente, descargar el artefacto y revisar tanto el reporte como las capturas visuales antes de dar por validada 1.2.8.

## Archivos

- `.github/workflows/ci-installer-windows.yml`
- `docs/specs/SPEC-101_installer_e2e_report_acl.spec.md`
- `scripts/tests/installer-upgrade-e2e-contract.test.mjs`

