# Ciclo de vida de instancias EvaluaPro

Este documento define qué debe considerarse una instancia funcional y qué
puede hacer el Installer Hub durante instalación, reparación, actualización,
rollback y desinstalación. El Hub es un plano de control: no es la autoridad
de los datos académicos.

## Instancias soportadas

| Instancia | Autoridad de datos | Runtime | Regla de convivencia |
| --- | --- | --- | --- |
| `docente-local` | SQLite local, normalmente bajo `C:\ProgramData\EvaluaPro\data` | Node portable + API/UI nativas, sin Docker | Una instancia productiva por host y raíz de datos |
| `saas-completo` | Servicios Docker/portal y sus volúmenes | Docker Compose y portal institucional | Requiere raíces, puertos y datos separados de cualquier instancia local |
| `dataset-prep` | Artefactos externos de QA | Ejecución batch de Node + `sharp` | No es servicio, no se instala y no se incluye en el ejecutable |
| Installer Hub | No contiene datos académicos | Burn/WPF + helper PowerShell | Una UI activa por host mediante mutex; puede reparar las instancias existentes |

La identidad mínima de una instancia es la tupla:
`flavorId`, `productCode/upgradeCode`, `installDir`, `dataDir/databaseUrl`,
puertos, canal y versión. En la configuración actual ambos sabores usan el
nombre de carpeta `EvaluaPro`; por ello no se autoriza convivencia side-by-side
por defecto. Si se requiere simultaneidad deberán separarse raíces de
instalación, datos, puertos e identidad MSI/Bundle, y demostrarse con pruebas.

## Estados y transiciones

```text
discovered -> inventoried -> backup-ready -> staged -> installed
                                                   -> configured -> healthy/running
healthy/running -> degraded -> repaired
healthy/running -> staged -> updated -> healthy/running
updated         -> failed -> rolled-back -> healthy/running
healthy/running -> retired -> uninstalled
```

`legacy` y `orphaned` son estados de inventario, no autorización para borrar.
El Hub debe:

1. detectar y mostrar instalación, versión, sabor, rutas de datos, payload y
   manifest;
2. conservar datos y generar/validar respaldo antes de una mutación;
3. preferir reparación sobre limpieza;
4. bloquear conflictos de raíces, puertos o sabores hasta una decisión
   explícita;
5. permitir rollback si la actualización o la comprobación de salud falla;
6. preservar datos en la desinstalación normal. La purga de datos debe ser una
   acción separada, visible y confirmada.

## Política de actualización

El canal estable consulta el repositorio oficial configurado en
`config/update-config.json`, exige el manifest de release y SHA-256 del asset,
y solo acepta una versión SemVer estrictamente mayor. Si el checkout local es
mayor que la última versión oficial, el estado es
`local-ahead-of-official`: no se hace downgrade automático; se ofrece el
diagnóstico y la decisión manual correspondiente.

Un update válido sigue esta secuencia: preflight y respaldo, detener solo el
árbol de procesos propiedad de la instancia, descargar a un directorio
versionado, verificar SHA-256, aplicar el instalador, reiniciar lo que estaba
activo, ejecutar health-check y conservar el estado anterior para rollback.

## Dataset de cámara OMR

El preparador de `tools/omr-camera-dataset/prepare.mjs` mantiene las imágenes
JPEG sin recomprimir, escribe `manifest.json`, `labels.jsonl`, hashes y
proveniencia, y verifica el ZIP expandiéndolo y comparando SHA-256. El artefacto
se conserva fuera del payload del Hub. Sin un bloque EXIF no se puede afirmar
marca, modelo, lente, exposición, ISO, número de serie o GPS de la cámara
física; el nombre `CamScanner` solo se registra como atribución de nombre de
archivo.

El ciclo de vida del dataset es: `raw -> manifested -> labeled -> verified ->
immutable archive -> retention/retirement`. Una etiqueta derivada de un
reporte OMR conserva su fuente y hash; no sustituye una revisión humana ni
demuestra por sí sola aceptación productiva.

## Referencias de implementación

- `config/installer-flavors.json`
- `config/update-config.json`
- `scripts/instance-lifecycle.mjs`
- `scripts/update-manager.mjs`
- `scripts/installer-burn/InstallerBurnHelper.ps1`
- `packaging/wix/BurnBootstrapperApp/EvaluaProBootstrapperApplication.cs`
- `docs/specs/SPEC-067_dataset_externo_y_ciclo_instancias.spec.md`
