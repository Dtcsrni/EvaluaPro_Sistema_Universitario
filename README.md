# EvaluaPro

**EvaluaPro** es una aplicación de escritorio para que el docente administre sus materias, prepare exámenes, procese hojas de respuestas OMR y revise calificaciones desde Windows. El producto que se mantiene para distribución es `docente-local`: la API y la interfaz docente trabajan en el equipo y guardan sus datos en SQLite.

[Descargas oficiales](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest) · [Documentación](docs/README.md) · [Manual docente](docs/MANUAL_USUARIO_DOCENTE.md) · [Reportar un problema](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/issues)

> La versión del código en `main` no equivale a una release pública. Para instalar, usa el ejecutable y el checksum que aparecen en la página de Releases de GitHub. No des por disponible una versión hasta verla publicada allí.

## Qué puedes hacer

- Organizar periodos, materias, grupos, alumnos, asistencia y temarios.
- Crear un banco de preguntas y diseñar plantillas de evaluación.
- Generar cuadernillos y hojas de respuesta con folios QR para vincular el material al registro correspondiente.
- Cargar escaneos para lectura OMR (reconocimiento de marcas ópticas), revisar casos ambiguos y confirmar las calificaciones desde la aplicación.
- Consultar y exportar información académica según las opciones habilitadas en el perfil.
- Respaldar y migrar datos con los flujos documentados. La base SQLite activa no debe sincronizarse directamente con OneDrive, una carpeta compartida o una memoria USB.

La operación local básica no necesita una cuenta de nube. Classroom, el portal de alumnos y otras conexiones remotas dependen de configuración, credenciales, despliegue y conectividad propios; no forman parte de una sincronización automática al instalar `docente-local`.

## Instalar en otro equipo

1. Abre [Releases](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest) y descarga el asset `EvaluaPro-InstallerHub-docente-local-v<versión>.exe`.
2. Descarga el archivo `.sha256` asociado y verifica el hash antes de ejecutar el instalador. La página de release incluye los artefactos publicados para cada versión.
3. Ejecuta el Installer Hub y sigue el asistente. Conserva una copia de seguridad antes de reparar, actualizar o migrar información existente.
4. Al terminar, abre EvaluaPro desde el acceso directo y consulta el [manual docente](docs/MANUAL_USUARIO_DOCENTE.md) para iniciar sesión y preparar el primer periodo.

Consulta [Instalación y actualización](docs/INSTALLER_HUB.md) para detalles, requisitos y recuperación. El instalador puede conservar datos durante una actualización; esa protección no sustituye un respaldo independiente.

## Requisitos para desarrollo

- Windows 10/11 de 64 bits para compilar el Installer Hub.
- Node.js 24 y npm compatibles con los `engines` definidos en el repositorio.

```bash
git clone https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario.git
cd EvaluaPro_Sistema_Universitario
npm ci
```

Comandos frecuentes:

```bash
npm run dev:backend
npm run dev:frontend
npm run lint
npm run typecheck
npm run docs:check
```

Revisa [`package.json`](package.json) para el catálogo completo de comandos y las instrucciones de [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de proponer cambios.

## Estado del producto

- **Perfil mantenido para distribución:** `docente-local` en Windows.
- **Datos operativos:** SQLite local; las actualizaciones no son un mecanismo de respaldo.
- **Release instalada:** consulta GitHub Releases; el número del repositorio, el tag y la versión publicada son estados distintos.
- **Integraciones externas:** requieren preparación específica y no deben suponerse disponibles en una instalación limpia.

## Documentación

Empieza en el [Centro documental](docs/README.md). Allí se separan las guías para docentes, las instrucciones de instalación, las decisiones de arquitectura, las especificaciones de desarrollo y las evidencias históricas.

EvaluaPro se distribuye bajo [GNU AGPL v3 o posterior](LICENSE). Lee la licencia antes de redistribuir o modificar el software.
