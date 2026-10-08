# Documentación de EvaluaPro

Este índice separa las guías para operar EvaluaPro de las especificaciones técnicas y los registros históricos. La aplicación que se prepara para uso en otros equipos es `docente-local` en Windows. La versión del repositorio, la publicada en GitHub y la instalada en una computadora deben verificarse por separado.

## Elige una ruta

| Si necesitas… | Empieza aquí |
| --- | --- |
| Instalar EvaluaPro en una computadora | [Instalación y actualización](INSTALLER_HUB.md) |
| Iniciar sesión y trabajar como docente | [Manual docente](MANUAL_USUARIO_DOCENTE.md) |
| Entender opciones de respaldo y migración | [Sincronización entre computadoras](SINCRONIZACION_ENTRE_COMPUTADORAS.md) |
| Diagnosticar una instalación o un servicio | [Runbook de operación](RUNBOOK_OPERACION.md) |
| Preparar o desplegar el proyecto | [Guía de despliegue](DESPLIEGUE.md) |
| Entender módulos y límites del sistema | [Arquitectura](ARQUITECTURA.md) y [arquitectura C4](ARQUITECTURA_C4.md) |
| Revisar privacidad o seguridad | [Política de seguridad](SECURITY_POLICY.md), [seguridad operativa](SEGURIDAD_OPERATIVA.md) y [aviso de privacidad](legal/aviso-privacidad-integral.md) |
| Desarrollar o revisar una funcionalidad | [Especificaciones](specs/) y [política SDD](POLITICA_SDD.md) |
| Distinguir código, tag y release | [Versionado](VERSIONADO.md) y [estado de releases](RELEASE_STATUS.md) |
| Consultar planeación comercial histórica | [Material comercial](comercial/README.md) |

## Uso docente

- [Manual completo](MANUAL_USUARIO_DOCENTE.md) — flujo desde la instalación hasta el respaldo y la consulta de resultados.
- [Tutorial ilustrado](tutoriales/MANUAL_USUARIO.md) — guía breve de configuración inicial con capturas del repositorio.
- [Prueba E2E del Installer Hub](tutoriales/installer-hub-docente-e2e.md) — evidencia visual de un recorrido de instalación; es material de QA, no una promesa de que toda versión pública haya pasado ese recorrido.
- [Mover datos entre equipos](SINCRONIZACION_ENTRE_COMPUTADORAS.md) — opciones y advertencias para exportar, importar o coordinar datos.

El instalador y el actualizador conservan datos operativos durante las operaciones cubiertas por sus contratos. Aun así, respalda la información antes de reparar, actualizar o migrar. Nunca sincronices directamente el archivo SQLite que está usando la aplicación.

## Diseño técnico y desarrollo

- [Arquitectura integral](ARQUITECTURA.md) · [C4](ARQUITECTURA_C4.md) · [diagramas](diagramas/)
- [Especificaciones por módulo](specs/) · [contratos](contracts/)
- [Guía Installer Hub](INSTALLER_HUB.md) · [despliegue](DESPLIEGUE.md)
- [Política SDD](POLITICA_SDD.md) · [WCAG para interfaces](WCAG_UI_POLICY.md) · [calidad UX](UX_QUALITY_CRITERIA.md)
- [Seguridad](SECURITY_POLICY.md) · [operación segura](SEGURIDAD_OPERATIVA.md) · [cumplimiento y privacidad](CUMPLIMIENTO.md)
- [Línea base de ingeniería](ENGINEERING_BASELINE.md) · [inventario de proyecto](INVENTARIO_PROYECTO.md)

Las especificaciones describen contratos o trabajo de ingeniería; una spec implementada no demuestra por sí sola que una función esté habilitada en el instalador, conectada a un servicio externo o incluida en la última release pública. Verifica el estado en el código, el manifiesto del instalador y la página de Releases.

## Releases y versiones

- La versión fuente se declara en `config/app-version.json` y se distribuye entre los paquetes por los scripts de versionado.
- Una rama `main` actualizada no publica automáticamente un instalador.
- La release pública se confirma en [GitHub Releases](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases).
- La versión instalada se confirma en la aplicación del equipo.

Consulta [VERSIONADO.md](VERSIONADO.md) y [RELEASE_STATUS.md](RELEASE_STATUS.md) antes de usar términos como “estable”, “publicada” o “disponible”.

## Convenciones del archivo

Los documentos bajo `docs/release/evidencias/`, `docs/handoff/sesiones/` y los cortes fechados de inventario son registros históricos. Se conservan como evidencia y no se reescriben para que parezcan describir el estado actual. Los índices y guías operativas sí se actualizan cuando cambian los flujos vigentes.

Índices automáticos e inventarios: [AUTO_DOCS_INDEX](AUTO_DOCS_INDEX.md), [AUTO_ENV](AUTO_ENV.md) e [inventario exhaustivo de código](INVENTARIO_CODIGO_EXHAUSTIVO.md).
