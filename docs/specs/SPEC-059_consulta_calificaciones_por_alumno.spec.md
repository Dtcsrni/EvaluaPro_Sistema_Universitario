---
id: SPEC-059
titulo: Consulta clara de calificaciones por alumno y examen
version: 1.6.5
fecha: 2026-09-30
autor: EvaluaPro Team
modulo: frontend_calificaciones
estado: approved
---

## Contexto

La pantalla de calificaciones concentra herramientas operativas distintas en una
columna estrecha. Esto dificulta consultar rápidamente qué calificación obtuvo cada
alumno en cada examen. Se requiere una vista resumida, filtrable y legible que sea el
punto de entrada de la pantalla, sin retirar el flujo OMR ni la calificación manual.

## Requisitos Funcionales

- REQ-001: La API debe exponer la lista académica del periodo autenticado en JSON,
  respetando el aislamiento por docente y el permiso `analiticas:leer`.
- REQ-002: La lista debe conservar Parcial 1, Parcial 2, Global y Final por alumno,
  incluso cuando existan varias calificaciones para el mismo alumno. La asignación
  debe resolver primero la etiqueta académica de la plantilla (Primer/Segundo
  Parcial, Parcial 1/2, Global). Cuando haya varios registros con la misma etiqueta,
  prevalece el más reciente; el orden de creación solo es fallback para datos
  históricos sin número explícito. Consulta JSON y exportación XLSX deben resolver
  el mismo registro por corte.
- REQ-003: La interfaz debe mostrar una tabla de consulta por alumno con matrícula,
  grupo, calificaciones y estado de captura.
- REQ-004: La consulta debe permitir buscar por nombre o matrícula y filtrar todos,
  calificados o pendientes.
- REQ-005: Seleccionar un alumno debe llevarlo al flujo de detalle manual existente,
  sin eliminar escaneo OMR, encuadre académico ni solicitudes de revisión.
- REQ-006: La nueva superficie debe conservar semántica accesible, foco visible y
  contraste WCAG mediante `npm run guard:wcag`.
- REQ-007: El journey visual debe esperar a que la vista de Calificaciones termine
  su carga diferida y exponga su encabezado accesible antes de capturarla; no debe
  aceptar una captura que solo muestre el estado transitorio «Cargando módulo...».

- REQ-008: El caption de la tabla y el encabezado auxiliar de acciones deben
  conservarse para tecnologías de asistencia, pero ocultarse visualmente mediante
  una regla `sr-only` comprobada en el navegador.
- REQ-009: La lista académica debe mostrar las cinco columnas físicas del Segundo
  Parcial con sus nombres: “Tareas y Ejercicios 2do Parcial”, “Practica 2do
  Parcial”, “Evaluación Continua 2do Parcial”, “Exámen 2do Parcial” y
  “Calificación Segundo Parcial”. Las tareas y práctica están en escala 0–10;
  evaluación continua y examen en escala 0–5.
- REQ-010: El valor de “Tareas y Ejercicios 2do Parcial” debe calcularse como
  `10 × suma(puntos obtenidos) ÷ suma(puntos posibles)`, solo con actividades
  seleccionadas y asignadas explícitamente a esa columna en Corte 2. Una entrega
  faltante suma cero únicamente con confirmación docente persistida; tareas no
  vencidas o sin calificar se excluyen.
- REQ-011: “Practica 2do Parcial” y “Exámen 2do Parcial” deben poder capturarse y
  modificarse manualmente por alumno/periodo, con alcance multi-docente,
  validación de escala, escritura idempotente y auditoría del valor anterior y
  nuevo, docente y fecha.
- REQ-012: “Evaluación Continua 2do Parcial” debe derivarse como
  `((0.60 × tareas) + (0.40 × práctica)) ÷ 2`, en escala 0–5. “Calificación
  Segundo Parcial” debe sumar evaluación continua y examen. Si falta algún
  componente requerido, el resultado derivado permanece vacío, no cero.
- REQ-013: La calificación automática OMR del examen debe mostrarse como
  referencia separada. No debe sustituir una captura manual ni formar parte del
  promedio Classroom de tareas.
- REQ-014: La exportación XLSX institucional debe llenar AO–AS con las mismas
  fuentes y cálculos de la consulta, conservar vacíos reales y no sustituir las
  columnas del libro por el resumen genérico de exámenes.
- REQ-015: La vista debe permitir capturar/modificar únicamente los componentes
  manuales autorizados y mostrar su estado/procedencia con etiquetas físicas
  completas y controles accesibles.
- REQ-016: La consulta, API de lista y XLSX deben reflejar las columnas físicas del
  Tercer Parcial: Exámen Global (0–5), Evaluación Continua 3er Parcial (0–5) y
  Calificación Tercer Parcial (0–10). El examen proviene del componente Global
  cuando no exista captura física; la continua usa actividades Classroom calificadas
  mapeadas explícitamente a C3, según puntos obtenidos/posibles, dividido entre 2
  para la escala física del libro. En el JSON de compatibilidad, `global` representa
  el total del tercer parcial (persistido o derivado); las fuentes del examen se
  exponen por separado en `examenGlobalComponente` y `examenGlobalLista`. Las notas
  Global/C3 y sumas no deben superar 10;
  los faltantes y actividades excluidas no se convierten en cero.
- REQ-017: Las calificaciones agregadas de P1, P2 y P3 deben permanecer entre 0 y
  10 tanto en la consulta como en la exportación XLSX, aunque algún componente
  aislado o histórico esté fuera de rango.
- REQ-018: La consulta presenta una única columna “Bono extracurricular” por
  alumno y permite proponer un valor entre 0 y 1. La vista previa calcula la
  calificación ponderada base, omite el bono cuando esa final es 10 y distribuye
  lo restante Global/C3 → P2 → P1; dentro de cada corte prioriza evaluación
  continua y después examen. La vista previa no escribe datos. La confirmación
  guarda un registro manual versionado e idempotente, y la recarga muestra el bono
  aplicado, los totales resultantes y la final ponderada. El XLSX exporta una sola
  columna de bono y fórmulas, solicita recálculo al abrir y mantiene cada parcial
  dentro de 10.
- REQ-019: Calificaciones permite consultar materias archivadas sin reactivar el
  periodo. Las mutaciones autorizadas de lista conservan el mismo contrato de
  versión e idempotencia que las materias activas; la marca de archivo no altera
  el estado del periodo. La API resuelve esos periodos mediante
  `GET /periodos?activo=false` y `GET /analiticas/lista-academica?periodoId=...`,
  con aislamiento por docente.
- REQ-020: Al exportar CSV/XLSX desde la GUI, el enlace de descarga debe conservar
  su URL temporal durante al menos un segundo después de activar el navegador. El
  mensaje solo confirma que se solicitó la descarga; no debe asegurar que el
  navegador guardó el archivo. Si la respuesta API falla, la interfaz no muestra
  un mensaje de éxito.
- REQ-021: El SDK oficial debe permitir descargar por API las exportaciones CSV y
  XLSX del periodo explícito, usando autenticación de sesión y devolviendo los
  bytes como `Buffer`. Un periodo vacío se rechaza localmente antes de hacer la
  solicitud.
- REQ-022: El SDK debe exigir periodo al consultar la lista y validar las etiquetas
  y escalas de componentes manuales antes de enviar; si se envía `version`, debe
  ser entero positivo. La vista previa del bono debe exigir periodo, alumno y un
  valor entre 0 y 1. Los rechazos locales no deben realizar solicitudes HTTP.

## Criterios de Aceptación

- AC-001: `GET /api/analiticas/lista-academica?periodoId=...` devuelve `{ filas }` y
  no incluye datos de otro docente.
- AC-002: Una prueba de dominio demuestra que dos parciales y un global del mismo
  alumno se conservan en sus columnas respectivas aunque el Segundo Parcial se
  haya creado antes que el Primer Parcial.
- AC-005: Con más de un registro explícitamente etiquetado para el mismo corte,
  la consulta y el XLSX muestran el más reciente, incluso si la entrada llega
  desordenada; la exportación conserva igualdad con la consulta.
- AC-006: El journey Playwright espera el encabezado accesible «Calificaciones»
  antes de capturar la pantalla de entrada al módulo.
- AC-007: El journey verifica que el caption accesible esté fuera del flujo visual
  y espera que desaparezcan los avisos transitorios antes de capturar.
- AC-008: Pruebas de dominio confirman la fórmula por puntos, el cero solo con
  confirmación, el 60/40 y la suma AQ+AR; los resultados calculados permanecen
  vacíos cuando faltan componentes.
- AC-009: Una captura repetida para el mismo alumno, periodo y columna actualiza
  un único registro y añade un evento de auditoría sin afectar otro docente.
- AC-010: Consulta JSON, edición, vista y exportación XLSX conservan valores
  iguales en AO–AS; AR manual permanece separado del resultado OMR.
- AC-011: Con una actividad Classroom C3 de 8.5/10 y un Global de 8/10, la
  consulta muestra los resultados fuente, el XLSX llena AT=4, AU=4.25 y AV=8.25;
  una actividad de otro corte no altera AU.
- AC-012: P1, P2 y P3 nunca exceden 10 en GUI, API ni fórmulas de cierre del XLSX.
- AC-013: La vista previa del bono no altera la lista; el guardado solo ocurre con
  acción explícita, respeta concurrencia/idempotencia y se reconcilia tras una
  respuesta incierta. La GUI expone el mismo orden de prioridad que el cálculo API.
- AC-014: El XLSX contiene una sola columna “Bono extracurricular”, formula el
  importe aplicado y las sumas de P1/P2/P3 siguiendo la prioridad definida, omite
  bono cuando la final base ponderada es 10 y solicita recálculo al abrir.
- AC-015: Una materia archivada aparece marcada como histórica; Calificaciones
  carga sus filas por API y permite cambios de lista autorizados sin reactivar el
  periodo. La API devuelve cero filas a otro docente y conserva la versión y
  auditoría al modificar una calificación archivada.
- AC-016: La prueba GUI verifica que la respuesta de exportación usa el periodo
  seleccionado, inicia un enlace con el nombre de archivo esperado, conserva la
  URL temporal por al menos un segundo tras el clic y comunica “descarga
  solicitada” sin afirmar que el archivo se guardó.
- AC-017: Las pruebas del SDK verifican que CSV y XLSX llaman sus rutas con el
  periodo indicado, conservan la sesión Bearer y devuelven los bytes sin
  convertirlos a texto o JSON; una cadena de periodo vacía no genera una llamada.
- AC-018: Las pruebas SDK rechazan periodo vacío, etiquetas fuera del contrato,
  valores por encima del máximo de cada componente e importes de bono fuera de
  0–1 y versiones no positivas sin enviar solicitudes; aceptan las etiquetas
  académicas y escalas vigentes.
- AC-003: Una prueba frontend demuestra que la tabla muestra calificaciones, permite
  filtrar y permite seleccionar al alumno.
- AC-004: Typecheck, lint, pruebas dirigidas, guard WCAG y build docente terminan con
  resultado exitoso.

## Matriz de Trazabilidad

| Requisito | Descripción | Archivo de Test Vinculado | Estado |
| --- | --- | --- |
| REQ-001, REQ-002 | Endpoint y agregación de lista académica | apps/backend/tests/listaAcademicaResumen.test.ts | Implementado |
| REQ-002 | Paridad de registro más reciente entre consulta y XLSX | apps/backend/tests/analiticas.xlsx.sv.contract.test.ts | Implementado |
| REQ-003, REQ-004, REQ-005 | Tabla de consulta y selección de alumno | apps/frontend/tests/seccionCalificaciones.resumen.test.tsx | Implementado |
| REQ-006 | Política WCAG y guard existente | scripts/tests/wcag-guard.contract.test.mjs | Implementado |
| REQ-007 | Captura del módulo tras carga diferida | tests/gui-responsive/journey-docente-integral.spec.ts | Implementado |
| REQ-008 | Caption accesible oculto visualmente | tests/gui-responsive/journey-docente-integral.spec.ts | Implementado |
| REQ-009, REQ-010, REQ-012 | Proyección física, puntos ponderados y exclusión de rubros no mapeados | apps/backend/tests/listaFisicaParcial2.test.ts | Implementado y verificado |
| REQ-011, REQ-013, REQ-015 | Captura manual versionada, auditoría, aislamiento y contraste OMR | apps/backend/tests/listaFisicaParcial2.persistencia.test.ts; apps/backend/tests/integracion/listaAcademicaContratos.test.ts | Implementado y verificado |
| REQ-014 | Exportación de AO–AS y vacíos preservados | apps/backend/tests/analiticas.xlsx.sv.contract.test.ts | Implementado y verificado |
| REQ-016 | Global/C3 en la lista y columnas AT–AV del XLSX | apps/backend/tests/listaAcademicaResumen.test.ts; apps/backend/tests/integracion/classroom.v2.test.ts; apps/backend/tests/analiticas.xlsx.sv.contract.test.ts; apps/frontend/tests/seccionCalificaciones.resumen.test.tsx | Implementado y verificado en foco |
| REQ-017 | Límites de 10 para totales parciales en consulta/lista | apps/backend/tests/listaFisicaParcial2.test.ts; apps/backend/tests/analiticas.xlsx.sv.contract.test.ts | Implementado y verificado en foco |
| REQ-018, AC-013 | Vista previa de solo lectura, guardado de bono versionado y reconciliación GUI/API | apps/backend/tests/bonoExtracurricular.test.ts; apps/backend/tests/integracion/listaAcademicaContratos.test.ts; apps/frontend/tests/seccionCalificaciones.resumen.test.tsx; scripts/tests/evaluapro-client.test.mjs | Pruebas focales ejecutadas: preview sin escritura, guardado e idempotencia, secuencia de confirmación GUI |
| AC-014 | Columna única, fórmulas de prioridad y recálculo en apertura del XLSX | apps/backend/tests/analiticas.xlsx.sv.contract.test.ts | Prueba focal ejecutada: columna BB y fórmulas enlazadas; recálculo al abrir habilitado en ExcelJS |
| REQ-020, AC-016 | Entrega de exportaciones CSV/XLSX desde la GUI | apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx | Pruebas focales pasan para ambas extensiones. E2E Edge confirmó descarga XLSX de 4 filas, encabezado único BB, 28 fórmulas y recálculo al abrir; el archivo físico quedó en Descargas. Las fórmulas aún no tienen caché de resultados antes de abrir Excel. |
| REQ-021, AC-017 | Descargas CSV/XLSX autenticadas mediante SDK API | scripts/tests/evaluapro-client.test.mjs; apps/backend/tests/integracion/apiSdkExportaciones.test.ts | SDK 39/39; integración 1/1 con servidor HTTP real, bearer, periodo aislado y conservación de bytes. |
| REQ-022, AC-018 | Validación local del periodo, etiquetas y escalas del SDK | scripts/tests/evaluapro-client.test.mjs | Prueba focal aprobada: periodo obligatorio, componente exacto y topes 10, 5.25, 5 y 1 antes de llamar a la API. |
| Captura UI y accesibilidad visual | Captura/edición manual por nombre de columna; contraste en tema claro | apps/frontend/tests/seccionCalificaciones.resumen.test.tsx; tests/gui-responsive/journey-docente-integral.spec.ts | Implementado y E2E Edge verificado |
| REQ-019, AC-015 | Consulta de materias archivadas en solo lectura y API por periodo | apps/frontend/tests/seccionCalificaciones.resumen.test.tsx; apps/backend/tests/integracion/listaAcademicaContratos.test.ts | Implementado; pruebas de regresión añadidas |

### Auditoría viva de GUI, API y libros institucionales (2026-09-30)

La GUI autenticada consultó 4 filas DDAW y 12 BI. La lista de EvaluaPro y los
libros OneDrive coinciden en Global para las 16 filas y en el bono de BI; P1 y P2
difieren en las 16 filas. Se conserva la discrepancia sin escribir sobre ninguna
fuente hasta confirmar cuál prevalece.

La descarga XLSX de BI falló inicialmente con HTTP 500 porque el runtime local no
contenía `LIBRO_CALIFICACIONES_PRODUCCION_BASE_SANITIZADA.xlsx`. Se copió el asset
del repositorio al bundle instalado y se verificó el SHA-256 idéntico. El reintento
desde la GUI descargó un XLSX de 12 alumnos con las columnas y fórmulas de la
plantilla y `fullCalcOnLoad=true`. Los resultados de las fórmulas no tienen valores
cacheados; requieren recálculo al abrir en una aplicación de hojas de cálculo.

## Fuera de alcance

La columna de examen OMR se conserva como referencia y no se reemplaza. La validación
visual automatizada disponible cubre tema claro; confirmar manualmente tema oscuro,
navegación completa por teclado y la GUI instalada antes de promover una release.
