# EvaluaPro

**EvaluaPro** reúne preparación de exámenes, lectura asistida de hojas de respuesta y revisión de resultados en una aplicación de escritorio para Windows. El perfil publicado es **`docente-local`**: los datos operativos se guardan en SQLite en la computadora donde se usa.

[Descargar desde GitHub Releases](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest) · [Guía de inicio](docs/MANUAL_USUARIO_DOCENTE.md) · [Instalación y actualización](docs/INSTALLER_HUB.md) · [Centro documental](docs/README.md) · [Reportar un problema](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/issues)

> Descarga el instalador y su archivo `.sha256` de la misma release. Comprueba el hash antes de ejecutar el EXE. El código de `main`, un tag o una release en borrador no representan una descarga pública.

## Empieza en tres pasos

1. Abre [la última release pública](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest) y localiza `EvaluaPro-InstallerHub-docente-local-v<versión>.exe`.
2. Descarga el archivo `.sha256` asociado y calcula el hash en PowerShell:

   ```powershell
   Get-FileHash .\EvaluaPro-InstallerHub-docente-local-v<versión>.exe -Algorithm SHA256
   ```

   Compara `Hash` con el checksum publicado. Si no coincide, no ejecutes el instalador.
3. Inicia Installer Hub, sigue los requisitos indicados y abre EvaluaPro al terminar. La [guía de instalación](docs/INSTALLER_HUB.md) cubre reparación, actualización y recuperación.

## Flujo docente

- **Organiza:** periodos, materias, grupos, alumnos y seguimiento disponible en el perfil.
- **Prepara:** preguntas y plantillas; genera documentos de examen con folios de referencia.
- **Procesa:** carga hojas escaneadas para lectura OMR (reconocimiento óptico de marcas).
- **Revisa:** verifica la identidad, las respuestas dudosas y los resultados antes de confirmar calificaciones.

La lectura OMR es asistida. El docente conserva la decisión final sobre revisión y confirmación de notas.

## Datos, privacidad y continuidad

- Cada instalación mantiene su propia SQLite. Instalar EvaluaPro en otro equipo **no** copia alumnos, exámenes ni calificaciones.
- Haz y verifica un respaldo antes de actualizar, reparar o migrar.
- Para mover datos, usa los mecanismos documentados de snapshot o exportación/importación. No sincronices directamente la SQLite activa con OneDrive, una carpeta compartida o una USB.
- Los respaldos y exportaciones pueden contener datos personales; protégelos y limita su acceso.
- Classroom, el portal de alumnos y otras integraciones requieren configuración adicional. No se activan automáticamente al instalar el perfil local.

Consulta [respaldo y migración](docs/SINCRONIZACION_ENTRE_COMPUTADORAS.md) y el [aviso de privacidad](docs/legal/aviso-privacidad-integral.md).

## Estado del producto

- **Distribución mantenida:** `docente-local` para Windows de 64 bits.
- **Almacenamiento operativo:** SQLite local.
- **Versión descargable:** la que figure en la release pública, no la versión declarada en `main`.
- **Licencia:** [GNU AGPL v3 o posterior](LICENSE).

## Desarrollo

Requisitos del repositorio: Node.js `>=24.15.0` y npm `>=12.1.0`.

```bash
git clone https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario.git
cd EvaluaPro_Sistema_Universitario
npm ci
```

Comandos habituales:

```bash
npm run dev:backend
npm run dev:frontend
npm run lint
npm run typecheck
npm run docs:check
```

Antes de cambiar código, revisa [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), el [índice documental](docs/README.md) y la spec correspondiente en [`docs/specs/`](docs/specs/). Consulta [`package.json`](package.json) para todos los comandos.

## Documentación

| Tarea | Guía |
| --- | --- |
| Primer uso como docente | [Manual docente](docs/MANUAL_USUARIO_DOCENTE.md) |
| Instalar, actualizar o reparar | [Installer Hub](docs/INSTALLER_HUB.md) |
| Respaldar o cambiar de equipo | [Sincronización y migración](docs/SINCRONIZACION_ENTRE_COMPUTADORAS.md) |
| Diagnosticar un problema | [Runbook](docs/RUNBOOK_OPERACION.md) |
| Arquitectura y desarrollo | [Centro documental](docs/README.md) |
| Versiones y releases | [Versionado](docs/VERSIONADO.md) · [Estado de releases](docs/RELEASE_STATUS.md) |

