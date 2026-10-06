# Manual de Usuario | EvaluaPro (Flavor Docente)

> **Versión Oficial**: `1.1.1` (Nativo Windows `docente-local`)  
> **Fecha de Emisión**: 2026-07-28  
> **Ámbito de Operación**: Cobertura exhaustiva de cada pantalla, formulario, botón y respuesta de la interfaz docente y portal de alumnos.

---

## Estructura del Flujo de Trabajo

El manual recorre minuciosamente cada interacción visual del sistema en 14 secciones estructuradas:

```
 [0. Instalación Hub] ──> [1. Acceso y Registro] ──> [2. Gestión de Materias]
                                                              │
 [5. Plantillas y PDF Examen] <── [4. Banco de Preguntas] <── [3. Alumnos, Asistencia y Temarios]
            │
            ▼
 [6. Lectura OMR y Jobs] ──> [7. Vinculación QR/Folio] ──> [8. Políticas y Evidencias]
                                                              │
 [11. Respaldos y Cifrado] <── [10. Reportes CSV/XLSX] <── [9. Calificación Global / Manual]
            │
            ▼
 [12. Publicación y Claves] ──> [13. Portal Alumno (Detalle)] ──> [14. Perfil y Cuenta Docente]
```

---

## Índice
1. [Paso 0: Descarga e Instalación Nativa (Installer Hub)](#paso-0-descarga-e-instalación-nativa-installer-hub)
2. [Paso 1: Acceso, Registro e Inicio de Sesión Docente](#paso-1-acceso-registro-e-inicio-de-sesión-docente)
3. [Paso 2: Gestión de Materias y Periodos Académicos](#paso-2-gestión-de-materias-y-periodos-académicos)
4. [Paso 3: Registro de Alumnos, Asistencias y Temarios](#paso-3-registro-de-alumnos-asistencias-y-temarios)
5. [Paso 4: Banco de Preguntas y Reactivos por Tema](#paso-4-banco-de-preguntas-y-reactivos-por-tema)
6. [Paso 5: Configuración de Plantillas y Generación PDF de Exámenes](#paso-5-configuración-de-plantillas-y-generación-pdf-de-exámenes)
7. [Paso 6: Lectura Asistida OMR, Hojas y Procesamiento del Job](#paso-6-lectura-asistida-omr-hojas-y-procesamiento-del-job)
8. [Paso 7: Vinculación de Entregas por Folio Único y QR](#paso-7-vinculación-de-entregas-por-folio-único-y-qr)
9. [Paso 8: Políticas de Evaluación y Evidencias Continuas](#paso-8-políticas-de-evaluación-y-evidencias-continuas)
10. [Paso 9: Calificación Global y Modo Manual Reactivo por Reactivo](#paso-9-calificación-global-y-modo-manual-reactivo-por-reactivo)
11. [Paso 10: Reportes y Exportación de Actas (CSV y XLSX)](#paso-10-reportes-y-exportación-de-actas-csv-y-xlsx)
12. [Paso 11: Respaldos y Seguridad Cifrada (AES-256-GCM)](#paso-11-respaldos-y-seguridad-cifrada-aes-256-gcm)
13. [Paso 12: Publicación a Portal Alumno y Claves de Acceso](#paso-12-publicación-a-portal-alumno-y-claves-de-acceso)
14. [Paso 13: Portal Alumno: Consulta y Detalle Comparativo](#paso-13-portal-alumno-consulta-y-detalle-comparativo)
15. [Paso 14: Perfil y Gestión de Cuenta Docente](#paso-14-perfil-y-gestión-de-cuenta-docente)

---

## Paso 0: Descarga e Instalación Nativa (Installer Hub)

El sistema EvaluaPro para docentes se distribuye como una aplicación nativa Windows autónoma:

1. Ejecute `EvaluaPro-InstallerHub-docente.exe`. El **Installer Hub** realiza un análisis automático de dependencias (Node ejecutable y SQLite embebido) sin necesidad de configurar Docker ni servicios adicionales.
2. Seleccione la carpeta de destino y el perfil de acceso `docente-local`. Presione **Instalar**.

![Paso 0 - Instalador Nativo Installer Hub WPF](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/01_dashboard.png)

---

## Paso 1: Acceso, Registro e Inicio de Sesión Docente

Al abrir EvaluaPro desde el escritorio:

1. **Pantalla de Inicio de Sesión**: Ingrese con sus credenciales institucionales.
![Paso 1a - Formulario de Inicio de Sesión Docente](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/07_acceso_login.png)

2. **Registro de Cuenta Nueva**: Si ingresa por primera vez, elija la opción **Registrar con correo**, complete su nombre, apellidos, correo y contraseña.
![Paso 1b - Formulario de Registro Docente](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/08_acceso_registro_form.png)

3. **Tablero Inicial**: Tras autenticarse, el sistema carga el panel de control principal del docente.
![Paso 1c - Tablero Inicial Docente](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/10_tablero_inicial.png)

---

## Paso 2: Gestión de Materias y Periodos Académicos

1. **Sección de Materias**: Acceda al menú **Materias**.
![Paso 2a - Vista de la Sección de Materias](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/11_materia_seccion.png)

2. **Captura de Datos**: Complete el nombre de la materia (ej. *Matemáticas I*), fechas del ciclo lectivo y grupos asignados (*Grupo A*).
![Paso 2b - Formulario con Datos de Materia](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/12_materia_formulario_llenado.png)

3. **Lista de Materias Activas**: La nueva materia queda inmediatamente dada de alta en SQLite y visible en el panel.
![Paso 2c - Confirmación y Listado de Materias](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/13_materia_creada_lista.png)

---

## Paso 3: Registro de Alumnos, Asistencias y Temarios

1. **Sección Alumnos**: Seleccione el módulo de gestión escolar.
![Paso 3a - Vista de Alumnos](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/15_alumno_seccion.png)

2. **Formulario de Registro**: Ingrese la matrícula oficial (ej. `CUH98765432`), nombres, apellidos, materia asignada y grupo.
![Paso 3b - Captura de Datos de Alumno](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/16_alumno_datos_llenados.png)

3. **Lista de Estudiantes**: Confirmación del registro en el listado de clase.
![Paso 3c - Alumno Creado en la Lista](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/17_alumno_creado_lista.png)

4. **Control de Asistencias**: Pase de lista y seguimiento diario de asistencias por grupo.
![Paso 3d - Control de Asistencias](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/18_asistencias_seccion.png)

5. **Seguimiento de Temarios**: Avance programático y gestión de unidades de aprendizaje.
![Paso 3e - Seguimiento de Temarios](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/19_temarios_seccion.png)

---

## Paso 4: Banco de Preguntas y Reactivos por Tema

1. **Vista General del Banco**: Organice el conocimiento por temas y reactivos.
![Paso 4a - Panel Principal del Banco de Preguntas](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/20_banco_seccion.png)

2. **Captura de Reactivos**: Diseñe preguntas de opción múltiple (A-E), asigne el tema correspondiente y defina la respuesta correcta.

---

## Paso 5: Configuración de Plantillas y Generación PDF de Exámenes

1. **Sección Plantillas**: Ingrese al diseñador de evaluaciones.
![Paso 5a - Sección de Plantillas](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/24_plantilla_seccion.png)

2. **Formulario de Plantilla**: Defina el título del examen, materia y seleccione las unidades a incluir.
![Paso 5b - Formulario de Configuración de Plantilla](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/25_plantilla_formulario.png)

3. **Confirmación de Creación**: Notificación de plantilla guardada exitosamente.
![Paso 5c - Plantilla Creada](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/26_plantilla_creada_exito.png)

4. **Panel de Generación**: Seleccione la plantilla y configure la versión individual o en lote.
![Paso 5d - Panel de Generación de Exámenes](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/27_plantilla_panel_generar.png)

5. **Examen en PDF Generado**: Cuadernillo con Folio Único e individualización por estudiante.
![Paso 5e - Examen PDF Individualizado con QR](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/28_examen_generado_pdf.png)

---

## Paso 6: Lectura Asistida OMR, Hojas y Procesamiento del Job

1. **Descarga de Hoja OMR**: Descargue e imprima la Hoja de Respuestas estandarizada.
![Paso 6a - Descarga de Hoja OMR](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/29_omr_descarga_hoja.png)

2. **Carga de Archivo Escaneado**: Cargue las imágenes o el PDF de escaneo al panel.
![Paso 6b - Carga de Escaneo OMR](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/30_omr_panel_carga.png)

3. **Job OMR en Procesamiento**: El motor visual analiza la rejilla de alvéolos en tiempo real.
![Paso 6c - Job OMR en Procesamiento](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/31_omr_job_procesando.png)

4. **Finalización y Confirmación**: Estado del Job completado y listo para revisión.
![Paso 6d - Job OMR Finalizado](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/32_omr_job_finalizado.png)

---

## Paso 7: Vinculación de Entregas por Folio Único y QR

1. **Sección Entrega**: Acceda a la vinculación física de evaluaciones.
![Paso 7a - Sección de Entrega](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/33_entrega_seccion.png)

2. **Captura de Folio / QR**: Escanee el código QR o ingrese el folio impreso en la hoja.
![Paso 7b - Captura de Folio Único y Alumno](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/34_entrega_folio_llenado.png)

3. **Vinculación Confirmada**: Registro de la entrega asociada al alumno.
![Paso 7c - Entrega Vinculada Exitosamente](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/35_entrega_vinculada_exito.png)

---

## Paso 8: Políticas de Evaluación y Evidencias Continuas

1. **Sección Evaluaciones**: Ajuste los porcentajes y ponderaciones del curso.
![Paso 8a - Sección de Evaluaciones](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/36_evaluaciones_seccion.png)

2. **Guardar Política**: Confirmación de la política institucional guardada.
![Paso 8b - Política Guardada](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/37_evaluaciones_politica_guardada.png)

3. **Evidencias Continuas**: Capture notas complementarias (proyectos, tareas, prácticas).
![Paso 8c - Evidencia Continuada Registrada](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/38_evaluaciones_evidencia_guardada.png)

---

## Paso 9: Calificación Global y Modo Manual Reactivo por Reactivo

1. **Panel de Calificaciones**: Consolidado general de notas del grupo.
![Paso 9a - Sección de Calificaciones](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/39_calificaciones_seccion.png)

2. **Modo Manual Activo**: Inspección y corrección de respuestas marca por marca.
![Paso 9b - Modo Manual de Calificación](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/40_calificaciones_modo_manual.png)

3. **Guardado Exitoso**: Actualización instantánea en la libreta de calificaciones.
![Paso 9c - Calificación Guardada Exitosamente](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/41_calificaciones_guardada_exito.png)

---

## Paso 10: Reportes y Exportación de Actas (CSV y XLSX)

1. **Sección de Reportes**: Selección de la materia y tipo de acta.
![Paso 10a - Sección de Reportes](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/42_reportes_seccion.png)

2. **Descarga CSV**: Exportación de datos tabulares procesables.
![Paso 10b - Descarga de Acta CSV](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/43_reportes_descarga_csv.png)

3. **Descarga XLSX**: Exportación del libro de actas oficial institucional.
![Paso 10c - Descarga de Libro XLSX Sanitizado](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/44_reportes_descarga_xlsx.png)

---

## Paso 11: Respaldos y Seguridad Cifrada (AES-256-GCM)

1. **Módulo de Sincronización y Backups**: Resguardo de la base de datos local.
![Paso 11a - Sección de Sincronización y Resguardos](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/45_sincronizacion_seccion.png)

2. **Exportar Backup Cifrado**: Generación de paquete comprimido con cifrado `AES-256-GCM`.
![Paso 11b - Paquete Cifrado Exportado](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/46_backup_exportar_cifrado.png)

3. **Importar y Restaurar Paquete**: Proceso seguro de restauración de respaldos.
![Paso 11c - Diálogo de Importación de Paquete](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/47_backup_importar_paquete.png)

---

## Paso 12: Publicación a Portal Alumno y Claves de Acceso

1. **Publicar Resultados**: Envíe las actas al servidor del portal de alumnos.
![Paso 12a - Panel de Publicación al Portal](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/48_publicacion_publicar.png)

2. **Generar Código de Acceso**: Emisión de la clave grupal de consulta.
![Paso 12b - Código de Acceso Generado](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/49_publicacion_codigo_generado.png)

---

## Paso 13: Portal Alumno: Consulta y Detalle Comparativo

1. **Acceso Alumno (`/acceso`)**: Pantalla de consulta para estudiantes.
![Paso 13a - Acceso al Portal Alumnos](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/50_portal_alumno_acceso.png)

2. **Ingreso de Credenciales**: Captura de código de acceso y matrícula.
![Paso 13b - Captura de Clave y Matrícula](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/51_portal_alumno_credenciales.png)

3. **Lista de Resultados**: Tablero de evaluaciones publicadas del estudiante.
![Paso 13c - Resultados Publicados](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/52_portal_alumno_resultados_lista.png)

4. **Detalle Comparativo**: Desglose de respuestas correctas, retroalimentación y gráfica por tema.
![Paso 13d - Detalle del Examen y Gráfica por Tema](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/53_portal_alumno_detalle.png)

---

## Paso 14: Perfil y Gestión de Cuenta Docente

Acceso a la configuración del usuario docente, cambio de clave y preferencias de la aplicación local.
![Paso 14 - Perfil y Configuración de Cuenta Docente](file:///c:/Users/evega/Documents/EvaluaPro/docs/assets/ui/54_docente_cuenta_perfil.png)

---

> **EvaluaPro Sistema Universitario** — *Manual de Usuario Docente v1.1.1 con Cobertura Visual Exhaustiva*
