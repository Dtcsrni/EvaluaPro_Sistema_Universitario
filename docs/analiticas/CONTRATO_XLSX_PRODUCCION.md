# Contrato XLSX de Produccion (Calificaciones)

## Plantillas físicas verificadas
- `lista_Inteligencia_de_Negocios_23A.xlsx`
- `lista(3).xlsx` (Desarrollo de Aplicaciones Web)
- Hoja contractual de ambas: `LIBRO DE CALIFICACIONES`
- Encabezados comparados con la plantilla de salida sanitizada: `C10:BA10`; los
  nombres y posiciones de las columnas coinciden en ambas listas.

## Estructura del libro
1. Cabecera institucional con merges/estilos predefinidos en filas 1-9.
2. Encabezado de datos en fila 10.
3. Datos por alumno desde fila 11.
4. Formatos numéricos:
- Columnas de calificación: 1 o 2 decimales según estilo original.
- Base 10 final: columna `BA` con formato numérico.

## Columnas y semántica (C..BA)
- `C`: `Nombre del alumno`
- `D`: `Id. del alumno` (matrícula)
- `E`: `Correo Alumno`
- `AJ`: `Tareas y Ejercicios 1er Parcial (60%)`
- `AK`: `Practica 1er Parcial (40%)`
- `AL`: `Evaluación Continua 1er Parcial` (0..5)
- `AM`: `Exámen 1er Parcial` (0..5)
- `AN`: `Calificación Primer Parcial` (0..10)
- `AO`: `Tareas y Ejercicios 2do Parcial`
- `AP`: `Practica 2do Parcial`
- `AQ`: `Evaluación Continua 2do Parcial` (0..5)
- `AR`: `Exámen 2do Parcial` (0..5)
- `AS`: `Calificación Segundo Parcial` (0..10)
- `AT`: `Exámen Global` (0..5)
- `AU`: `Evaluación Continua 3er Parcial (Proyecto)` (0..5)
- `AV`: `Calificación Tercer Parcial` (0..10)
- `AW`: `Calificación Tercer Parcial ` (encabezado duplicado en el original)
- `AX`: `Porcentaje 1er y Segundo Parcial`
- `AY`: `Porcentaje 1er y Segundo Parcial ` (encabezado duplicado en el original)
- `AZ`: `Calificación Final`
- `BA`: `Calificación Final (Base 10)`

## Fórmulas contractuales detectadas
- `AL = (((AJ*10/$AJ$7)*0.6 + AK*0.4)/1)*5/10`
- `AN = AL + AM`
- `AQ = (((AO*10/$AJ$8)*0.6 + AP*0.4)/1)*5/10`
- `AS = AQ + AR`
- `AV = AT + AU`
- `AW = (AV*5/10)*60/5`
- `AX = (AN*5)/10 + (AS*5)/10`
- `AY = (AX*5/10)*40/5`
- `AZ = AW + AY`
- `BA = AZ * 0.1`

## Regla operativa acordada para segundo parcial

La fórmula histórica anterior describe el formato recibido. Para esta integración,
el docente confirmó que “Tareas y Ejercicios 2do Parcial” debe ser el promedio
ponderado por puntos en escala 0–10: `10 × Σ puntos obtenidos / Σ puntos posibles`.
Por omisión entran todas las actividades activas mapeadas al segundo parcial; el
docente puede excluir actividades individualmente. Esta preferencia no detiene la
sincronización ni elimina evidencias.
El promedio de “Evaluación Continua 2do Parcial” es
`(0.60 × AO + 0.40 × AP) / 2`, con ambas capturas completas. Esta regla y los
campos manuales indicados en el mapeo aplicado rigen la proyección de esta versión.

## Mapeo a MongoDB actual
Colecciones:
- `alumnos`: nombre, matrícula, correo
- `calificaciones`: valores por examen parcial/global

Mapeo aplicado para salida XLSX:
- `AL <- evaluacionContinuaTexto (parcial 1)`
- `AM <- calificacionExamenFinalTexto (parcial 1)`
- `AN <- calificacionParcialTexto (parcial 1)` o `AL+AM`
- `AO <- 10 × suma(puntos Classroom obtenidos) / suma(puntos posibles)` para actividades activas asignadas explícitamente al corte 2 e incluidas en la selección docente; por omisión se incluyen todas. Solo calificaciones publicadas participan. Ceros publicados cuentan; borradores, pendientes, sin mapeo o sin máximo positivo se excluyen.
- `AP <- captura manual de Practica 2do Parcial (0..10)`
- `AQ <- (AO*0.6 + AP*0.4)/2` cuando ambos componentes existen; en otro caso queda visualmente vacío.
- `AR <- captura manual de Exámen 2do Parcial (0..5), más 0.25 únicamente si el docente marca el bono de guía de estudio; máximo 5.25.
- `AS <- AQ+AR` solo cuando ambos componentes existen; en otro caso queda visualmente vacío.
- `AT <- calificacionExamenFinalTexto (global)`
- `AU <- proyectoTexto (global)`
- `AV <- calificacionGlobalTexto (global)` o `AT+AU`
- `AW..BA` se recalculan con fórmula contractual.

Nota importante:
- La nota OMR del examen de segundo parcial se expone como resultado automático independiente y nunca se copia a `AR`; la captura física manual del docente es la única fuente de `AR`.
- Una entrega sin nota publicada no se presume como cero aunque su fecha haya pasado; solo se incluye cero cuando Classroom trae `assignedGrade = 0`.
- `AQ` y `AS` usan fórmulas protegidas contra componentes incompletos para no presentar un cero artificial como calificación.

## Endpoint contractual
- `GET /api/analiticas/calificaciones-xlsx?periodoId=<id>`
- Tipo: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Archivo: `calificaciones-produccion.xlsx`

## Criterios de validación
1. El archivo abre en Excel sin reparación.
2. Mantiene hoja `LIBRO DE CALIFICACIONES` y estilo base de plantilla.
3. Respeta fórmulas `AN..BA` para cada fila generada.
4. Las calificaciones de Mongo para parcial/global coinciden en columnas `AL..AV`.
