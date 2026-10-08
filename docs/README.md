# Documentación de EvaluaPro

Usa este índice para llegar a la guía correcta. La distribución preparada para otros equipos es **`docente-local` para Windows**. Los contratos y la evidencia técnica no garantizan por sí solos que cada función o integración esté en un asset público.

## Soy docente y quiero…

| Necesito… | Abre |
| --- | --- |
| Instalar EvaluaPro y verificar el instalador | [Instalación y actualización](INSTALLER_HUB.md) |
| Preparar mi primera materia y evaluación | [Manual docente](MANUAL_USUARIO_DOCENTE.md) |
| Respaldar o mover información a otro equipo | [Sincronización entre computadoras](SINCRONIZACION_ENTRE_COMPUTADORAS.md) |
| Resolver un problema de inicio o instalación | [Runbook de operación](RUNBOOK_OPERACION.md) |
| Entender privacidad y tratamiento de datos | [Aviso de privacidad](legal/aviso-privacidad-integral.md) |

### Ruta de inicio

1. Descarga desde [la última release pública](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest).
2. Verifica el checksum del instalador antes de ejecutarlo.
3. Instala `docente-local` y confirma que la aplicación abre en ese equipo.
4. Crea un respaldo antes de actualizar o migrar y vuelve a verificar los datos después de importarlos.

La base SQLite activa no es un mecanismo de sincronización. Usa la guía de [respaldo y migración](SINCRONIZACION_ENTRE_COMPUTADORAS.md).

## Desarrollo y operación técnica

| Tema | Referencia |
| --- | --- |
| Estructura y módulos | [Arquitectura](ARQUITECTURA.md), [diagramas C4](ARQUITECTURA_C4.md), [diagramas](diagramas/) |
| Instalador Windows | [Guía Installer Hub](INSTALLER_HUB.md) |
| Build y despliegue | [Despliegue](DESPLIEGUE.md) |
| Contratos por módulo | [Especificaciones](specs/) y [contratos](contracts/) |
| Desarrollo guiado por specs | [Política SDD](POLITICA_SDD.md) |
| Interfaz accesible | [Política WCAG](WCAG_UI_POLICY.md) y [criterios UX](UX_QUALITY_CRITERIA.md) |
| Seguridad y cumplimiento | [Política de seguridad](SECURITY_POLICY.md), [seguridad operativa](SEGURIDAD_OPERATIVA.md), [cumplimiento](CUMPLIMIENTO.md) |
| CI/CD y dependencias | [DevOps baseline](DEVOPS_BASELINE.md) |
| Versiones y publicación | [Versionado](VERSIONADO.md), [estado](RELEASE_STATUS.md), [gate estable](RELEASE_GATE_STABLE.md) |

## Estado y evidencia

- La versión fuente se declara en `config/app-version.json`.
- `main`, el tag, una release borrador, una release pública y una instalación local son estados diferentes.
- [GitHub Releases](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases) es la fuente de verdad para saber qué instalador está disponible.
- Las specs describen contratos de ingeniería; no prueban por sí solas que un servicio externo esté configurado o que una función aparezca en el instalador.

## Tutoriales e histórico

- [Manual ilustrado](tutoriales/MANUAL_USUARIO.md).
- [Recorrido E2E del Installer Hub](tutoriales/installer-hub-docente-e2e.md): evidencia del recorrido indicado, no una garantía para todas las releases.
- [Material comercial histórico](comercial/README.md).

Los archivos de `docs/release/evidencias/`, `docs/handoff/sesiones/` y los cortes fechados de inventario son registros históricos: se conservan sin reescribirlos como si describieran el estado actual. Las guías e índices vigentes sí deben mantenerse al día.

Índices generados: [AUTO_DOCS_INDEX](AUTO_DOCS_INDEX.md), [AUTO_ENV](AUTO_ENV.md) e [inventario exhaustivo de código](INVENTARIO_CODIGO_EXHAUSTIVO.md).
