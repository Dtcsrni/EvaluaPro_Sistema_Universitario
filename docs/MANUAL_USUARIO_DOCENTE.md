# Manual de EvaluaPro para docentes

Esta guía cubre el perfil de escritorio `docente-local` en Windows: instalación, preparación de un curso, generación de exámenes, revisión OMR y respaldo de datos.

> **Estado de versión.** Al corte del 2026-10-08, `main` declara `1.2.6`, mientras que la página pública de GitHub Releases/latest muestra `v1.1.6`. Descarga solo lo que aparezca publicado en [GitHub Releases](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest). Los nombres de secciones y botones pueden variar entre versiones.

## Antes de empezar

- Usa Windows de 64 bits y una cuenta con permisos para instalar el producto.
- La instalación puede necesitar Node.js 24; Installer Hub detecta y prepara este requisito según el equipo.
- Prepara la lista del grupo y las preguntas antes de generar una evaluación.
- Si ya hay datos en el equipo, crea un respaldo antes de actualizar, reparar o migrar.

## 1. Descargar e instalar

1. Abre [Releases](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest).
2. Descarga el asset `EvaluaPro-InstallerHub-docente-local-v<versión>.exe` y su archivo `.sha256`.
3. Comprueba que el hash calculado coincida con el valor publicado antes de ejecutar el EXE.
4. Inicia el Installer Hub y completa las verificaciones que muestra. Sigue las instrucciones de Windows si solicita instalar un prerequisito.
5. Cuando finalice, abre EvaluaPro desde el acceso directo y confirma que el tablero y el estado de la API local estén disponibles.

Para reparación, actualización o problemas de inicio, consulta la [guía del Installer Hub](INSTALLER_HUB.md) y el [runbook](RUNBOOK_OPERACION.md).

## 2. Preparar la primera materia

1. Inicia sesión con una cuenta docente habilitada para esa instalación. Usa el mecanismo que muestre la pantalla de acceso.
2. Crea el periodo y la materia; define las fechas y el grupo de acuerdo con tu calendario.
3. Registra al alumnado y revisa matrículas y asignaciones antes de guardar.
4. Configura las asistencias y el temario si forman parte del flujo de tu curso.

La base de datos pertenece a esta instalación. Instalar EvaluaPro en otro equipo no copia alumnos, materias ni calificaciones.

## 3. Diseñar y generar un examen

1. Crea o selecciona los temas y reactivos del banco.
2. En el diseñador, elige la materia, incorpora las preguntas y revisa instrucciones, ponderación y vista previa.
3. Genera el PDF desde la plantilla. Revisa que corresponda al grupo y examen previstos.
4. Guarda el PDF y utiliza sus folios/QR para relacionar la entrega con el registro correcto.

Antes de imprimir un lote, comprueba la primera página, la orientación y que el QR se lea en una copia de prueba.

## 4. Procesar hojas de respuestas

1. Abre el flujo OMR de la aplicación y carga el archivo de escaneo en uno de los formatos que acepte la pantalla.
2. Comprueba el folio, el alumno y el examen detectados antes de asociar o cerrar el proceso.
3. Revisa cada advertencia, respuesta ambigua o excepción. OMR significa reconocimiento óptico de marcas: la lectura es asistida y no reemplaza la revisión docente.
4. Confirma la calificación solo después de compararla con la clave y la política de evaluación aplicable.
5. Conserva el original escaneado y el historial que necesites para atender una aclaración.

No asignes una calificación a partir de una captura o sugerencia automática sin verificar la identidad del examen y del alumno.

## 5. Consultar y exportar resultados

Selecciona el periodo y la materia correctos en Calificaciones o Analíticas. Antes de exportar, valida el rango, el encabezado y el archivo generado. Trata los CSV/XLSX como datos personales del alumnado y almacénalos conforme a las reglas de tu institución.

Publicar calificaciones en Classroom o en un portal de alumnos requiere configuración adicional, permisos y conectividad. La instalación local no activa ni completa esa publicación por sí sola.

## 6. Respaldar y mover los datos

Usa la opción de exportación/importación de respaldo descrita en [Sincronización entre computadoras](SINCRONIZACION_ENTRE_COMPUTADORAS.md). Antes de restaurar un respaldo, valida su origen y conserva una copia de la base actual.

- No sincronices la SQLite activa con OneDrive, una unidad de red o una memoria USB.
- Usa los archivos de snapshot/exportación que genera EvaluaPro.
- Confirma la integridad y el contenido en el equipo destino antes de retirar la copia anterior.
- Los respaldos pueden contener datos personales; protégelos con una contraseña robusta y guárdalos en una ubicación controlada.

## 7. Actualizar EvaluaPro

1. Crea y verifica un respaldo.
2. Abre la release que quieres instalar en GitHub; comprueba tag, fecha, asset y checksum.
3. Ejecuta el Installer Hub descargado y sigue el flujo de actualización.
4. Abre EvaluaPro y confirma la versión visible, el acceso a los datos y el estado local de los servicios.
5. Conserva el reporte de instalación si algo falla y consulta el [runbook de operación](RUNBOOK_OPERACION.md).

La actualización preserva datos según el contrato del instalador, pero no reemplaza una copia de seguridad previa ni demuestra por sí sola que una migración de datos haya concluido correctamente.

## Guías relacionadas

- [Centro documental](README.md)
- [Instalación y actualización](INSTALLER_HUB.md)
- [Mover datos entre computadoras](SINCRONIZACION_ENTRE_COMPUTADORAS.md)
- [Despliegue](DESPLIEGUE.md)
- [Aviso de privacidad](legal/aviso-privacidad-integral.md)
- [Estado de releases](RELEASE_STATUS.md)
