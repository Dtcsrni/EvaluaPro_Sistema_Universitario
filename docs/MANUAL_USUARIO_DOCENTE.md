# Manual docente de EvaluaPro

Guía práctica para **`docente-local` en Windows**: instalar, preparar un curso, generar y revisar una evaluación y conservar los datos. Las pantallas pueden variar entre versiones; confirma las opciones de tu instalación y las notas de la release.

## Antes de empezar

- Windows de 64 bits y permisos para completar la instalación.
- Internet para descargar la release y los requisitos que solicite Installer Hub. La operación local y las integraciones externas son distintas.
- Lista del grupo y material de evaluación que quieras registrar.
- Si ya tienes información en EvaluaPro, un respaldo verificado antes de actualizar, reparar o migrar.
- Una ubicación controlada para PDFs y respaldos: pueden incluir datos personales.

## 1. Descargar e instalar

1. Abre [Releases de GitHub](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest).
2. Descarga `EvaluaPro-InstallerHub-docente-local-v<versión>.exe` y el archivo `.sha256` asociado.
3. En PowerShell, calcula el hash:
   ```powershell
   Get-FileHash .\EvaluaPro-InstallerHub-docente-local-v<versión>.exe -Algorithm SHA256
   ```
   Compara el resultado con el checksum de la misma release. Si difiere, no ejecutes el instalador.
4. Ejecuta Installer Hub y sigue las comprobaciones que muestre. Lee cualquier solicitud de reinicio o instalación de requisitos.
5. Abre EvaluaPro desde el acceso directo y confirma que muestra la pantalla de inicio y una versión instalada.

Para reparar o revisar logs, consulta [Instalación y actualización](INSTALLER_HUB.md) y el [runbook](RUNBOOK_OPERACION.md).

## 2. Prepara un curso

1. Inicia sesión con la cuenta docente preparada para esa instalación.
2. Selecciona o crea el periodo académico y la materia.
3. Revisa grupo y alumnado antes de guardar.
4. Configura asistencia o temario si forman parte de tu curso.
5. Comprueba el periodo activo antes de capturar actividades o calificaciones.

Cada equipo tiene su propia base local. Instalar la aplicación en otro equipo no transfiere estos registros.

## 3. Diseña y genera una evaluación

1. Elige los temas y reactivos adecuados para el objetivo de evaluación.
2. En el diseñador, selecciona la materia y arma la plantilla.
3. Revisa instrucciones, preguntas, opciones, ponderación y vista previa.
4. Genera el PDF y confirma que corresponde al periodo, materia, grupo y plantilla correctos.
5. Haz una impresión de prueba y comprueba la orientación y legibilidad del folio QR antes de imprimir un lote.

Guarda el PDF original con un nombre que identifique curso y evaluación sin incluir datos personales innecesarios.

## 4. Lee y revisa hojas OMR

OMR significa *reconocimiento óptico de marcas*. La aplicación interpreta marcas en hojas escaneadas, pero no reemplaza la revisión docente.

1. Abre el flujo OMR y carga un PDF o imagen que acepte la pantalla.
2. Comprueba que el folio vincule la hoja con el examen correcto.
3. Revisa alumno, respuestas, advertencias y casos ambiguos.
4. Compara la lectura con la clave y la política de evaluación aplicable.
5. Confirma la calificación solo después de verificar identidad y resultado.
6. Conserva el escaneo fuente y la referencia del lote cuando necesites trazabilidad.

Una hoja aceptada o una lectura automática no equivale por sí sola a una nota confirmada.

## 5. Consulta y exporta resultados

Selecciona el periodo y la materia correctos. Antes de compartir una exportación, revisa encabezados, filas y archivo de salida. Protege CSV/XLSX con datos del alumnado de acuerdo con las reglas de tu institución.

Classroom y el portal de alumnos requieren configuración, permisos y conectividad independientes; la instalación local no publica notas automáticamente.

## 6. Respalda o cambia de computadora

Usa snapshot o exportación/importación descritos en [Sincronización entre computadoras](SINCRONIZACION_ENTRE_COMPUTADORAS.md).

1. En el equipo origen, crea el respaldo en EvaluaPro y conserva una copia independiente.
2. En el equipo destino, verifica origen e integridad y usa la validación disponible antes de importar.
3. Importa el formato compatible desde la aplicación; no reemplaces manualmente la base activa.
4. Inicia sesión y comprueba periodos, materias, archivos y registros antes de retirar la copia anterior.

No sincronices la SQLite abierta por EvaluaPro con OneDrive, una carpeta compartida o una USB. Protege los respaldos y limita quién puede acceder a ellos.

## 7. Actualiza

1. Crea y verifica un respaldo.
2. Descarga la nueva release pública y su checksum; confirma que pertenecen al mismo tag.
3. Ejecuta Installer Hub y sigue el flujo de actualización disponible.
4. Abre la aplicación y comprueba versión, acceso y datos.
5. Si algo falla, conserva el log del Hub y consulta el [runbook](RUNBOOK_OPERACION.md). No borres la base ni fuerces una migración manual.

La protección de datos del instalador no sustituye el respaldo ni demuestra por sí sola que la migración concluyó correctamente.

## Guías relacionadas

- [Instalación y actualización](INSTALLER_HUB.md)
- [Respaldo y migración](SINCRONIZACION_ENTRE_COMPUTADORAS.md)
- [Runbook de operación](RUNBOOK_OPERACION.md)
- [Aviso de privacidad](legal/aviso-privacidad-integral.md)
- [Estado de releases](RELEASE_STATUS.md)
