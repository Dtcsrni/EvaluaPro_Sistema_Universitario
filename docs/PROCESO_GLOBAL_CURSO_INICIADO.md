# Proceso estandar para global desde curso iniciado

Fecha de corte: 2026-06-25

## Objetivo

Permitir que un docente adopte EvaluaPro en un curso ya iniciado y pueda preparar un examen global usando:

- lista/calificaciones existentes en XLSX,
- temario oficial o programa de asignatura en DOCX,
- encuadre o politica de evaluacion,
- examenes parciales previos generados fuera de EvaluaPro,
- materiales visuales o documentos de apoyo.

El proceso debe aportar valor desde el primer dia sin exigir que los parciales anteriores hayan sido creados originalmente dentro del sistema.

## Evidencia de entrada revisada

Muestras locales usadas para definir el flujo:

- `admin_calidad_mayo_junio.xlsx`
  - hoja principal: `LIBRO DE CALIFICACIONES`
  - columnas base detectadas: `Nombre del alumno`, `Id. del alumno`, `Correo Alumno`
  - contiene bloques de evaluacion continua y parciales.
- `electro_app_digital_mayo-junio.xlsx`
  - hoja principal: `LIBRO DE CALIFICACIONES`
  - columnas base detectadas: `Nombre del alumno`, `Id. del alumno`, `Correo Alumno`
  - contiene estructura compatible con el libro anterior.
- `ADMINISTRACION DE LA CALIDAD.docx`
  - contiene objetivo general, temas/subtemas y actividades de aprendizaje.
- `ELECTRONICA Y APLICACIONES DIGITALES.docx`
  - contiene metadatos curriculares de asignatura.
- `ENCUADRE LISC.docx`
  - declara politica de evaluacion: examenes 50%, evaluacion continua 50%, parciales 20/20 y global 60 dentro del bloque de examenes.
- Examenes parciales DOCX de Administracion de la Calidad y Electronica
  - contienen reactivos de opcion multiple, instrucciones, valor total y evidencias de temas evaluados.

## Dictamen funcional actual

El sistema ya cubre parte del flujo:

- periodos/materias y alumnos mediante CRUD local;
- banco de preguntas con temas operativos;
- plantillas parcial/global;
- generacion PDF;
- entrega y calificacion;
- publicacion a portal alumno;
- importacion Classroom con riesgos operativos documentados.

Brechas para curso ya iniciado:

- no hay ingesta local estandarizada CSV/XLSX para roster/calificaciones existentes;
- no hay entidad formal de temario curricular con avance `pendiente|en_progreso|completo`;
- los temas actuales del banco no equivalen a avance de programa;
- no hay importador de parciales DOCX para registrar examenes externos como evidencia reutilizable;
- no hay sesion formal de aplicacion de examen con presencia, inicio, entrega, incidencias y cierre por alumno.

## Flujo docente propuesto

### 1. Crear o seleccionar curso

Datos minimos:

- materia,
- grupo,
- periodo,
- docente,
- politica de evaluacion.

Si el curso ya existe, el asistente de hidratacion debe trabajar sobre ese curso y no duplicarlo.

### 2. Importar lista existente

Entradas soportadas:

- XLSX tipo libro de calificaciones,
- CSV,
- Google Classroom cuando este configurado,
- captura manual como fallback.

Deteccion minima:

- nombre del alumno,
- matricula o identificador,
- correo,
- grupo si existe,
- columnas de parciales/evaluacion continua si existen.

Reglas:

- mostrar preview antes de persistir;
- no importar filas vacias o totales;
- detectar duplicados por `periodoId + matricula`;
- permitir matching por correo cuando falte matricula;
- actualizar alumnos existentes sin borrar datos locales;
- reportar `creados`, `actualizados`, `omitidos`, `conflictos`.

### 3. Hidratar calificaciones historicas

El XLSX puede traer calificaciones de evaluacion continua y parciales previos. Estas deben entrar como evidencias historicas, no como examenes generados por EvaluaPro.

Modelo recomendado:

- `origen=importacion_xlsx`
- `tipo=continua|parcial_externo|global_externo`
- `corte=parcial1|parcial2|global`
- `puntajeOriginal`
- `puntajeMaximo`
- `calificacionDecimal`
- `columnaOrigen`
- `archivoOrigenHash`

Esto permite calcular el global aunque P1/P2 no hayan sido generados con la herramienta.

### 4. Importar temario y avance

El DOCX de programa debe alimentar una entidad distinta a los temas del banco.

Entidad propuesta: `TemarioItem`

- `periodoId`
- `titulo`
- `tipo=unidad|tema|subtema`
- `orden`
- `estado=pendiente|en_progreso|completo`
- `fuente=docx|manual`
- `textoFuente`

El docente debe poder marcar temas como completos desde una vista simple de checklist.

### 5. Importar parciales previos como evidencia

Los DOCX de P1/P2 deben registrarse como examenes externos:

- titulo,
- corte,
- total de reactivos detectado,
- valor total declarado,
- reactivos extraidos cuando sea viable,
- temas inferidos o asignados manualmente,
- archivo origen y hash.

El sistema no debe asumir que todo reactivo extraido esta listo para banco. Debe quedar en estado `borrador_importado` hasta revision docente.

### 6. Preparar banco para global

Fuentes:

- preguntas ya existentes en banco,
- preguntas importadas de parciales previos,
- temas/subtemas completos del temario,
- materiales de apoyo o infografias.

Reglas:

- separar `reactivo aprobado` de `reactivo sugerido`;
- permitir editar/redactar antes de usar;
- etiquetar por tema curricular y tema de banco;
- evitar duplicados por similitud de enunciado.

### 7. Generar global

El asistente debe pedir:

- alcance: temas completos, temas seleccionados o todo el programa;
- ponderacion: examen teorico, practica/proyecto, evaluacion continua;
- numero de reactivos;
- nivel de dificultad;
- inclusion/exclusion de parciales previos;
- revision manual antes de generar PDF.

Salida:

- plantilla global editable,
- PDF,
- hoja OMR cuando aplique,
- bitacora de fuentes usadas.

### 8. Aplicar y cerrar sesion de examen

Entidad propuesta: `SesionExamen`

- `periodoId`
- `plantillaId` o `examenGeneradoId`
- `tipo=global`
- `estado=programada|activa|cerrada|cancelada`
- `iniciadaEn`
- `cerradaEn`
- `alumnosEsperados`
- `alumnosPresentes`
- `incidencias`

Por alumno:

- `estado=esperado|presente|ausente|en_progreso|entregado|calificado`
- `entregadoEn`
- `folio`
- `observaciones`

Esto formaliza pase de lista y seguimiento durante la aplicacion.

## Contrato de importacion recomendado

Endpoint inicial:

`POST /api/hidratacion-cursos/preview`

Entrada:

- archivo,
- `periodoId`,
- tipo detectado o forzado: `xlsx_calificaciones|docx_temario|docx_examen_externo|material_apoyo`,
- opciones de mapeo.

Salida:

- `detectedType`,
- `confidence`,
- `columns`,
- `rowsPreview`,
- `warnings`,
- `proposedActions`.

Persistencia:

`POST /api/hidratacion-cursos/importar`

Debe aceptar un `previewId` y un plan confirmado por el docente.

## Criterio de listo para MVP docente dia 1

No declarar esta capacidad lista hasta cumplir:

1. importar XLSX con preview y upsert de alumnos;
2. detectar y mapear columnas base `Nombre del alumno`, `Id. del alumno`, `Correo Alumno`;
3. registrar calificaciones historicas como evidencias;
4. crear temario editable desde DOCX o manual;
5. marcar temas como completos;
6. registrar parciales DOCX como examenes externos;
7. generar una plantilla global desde temas/evidencias seleccionadas;
8. abrir/cerrar sesion de aplicacion con estados por alumno;
9. publicar resultados sin exigir portal local en `docente-local`;
10. dejar evidencia automatizada con fixtures anonimizados derivados de este tipo de archivos.

## Siguiente implementacion recomendada

Primero construir `hidratacion-cursos` para XLSX local:

- parser XLSX,
- preview,
- mapeo de columnas,
- upsert de alumnos,
- evidencias historicas,
- reporte de importacion.

Despues implementar temario y sesion de examen. La generacion asistida del global debe apoyarse en esas dos bases para no convertirse en un flujo manual disfrazado.
