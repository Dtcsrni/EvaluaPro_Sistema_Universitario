# Reconciliation Report: answer_key vs visible canonical bank

- Generated at: 2026-03-08
- Questions compared: 15
- Matches: 6
- Mismatches: 9
- Match rate: 0.4

La answer_key actual no es consistente con la clave visible canónica del lote A050929D. Se detectaron discrepancias materiales que deben corregirse antes de usar este dataset como verdad base para calibración OMR.

## Mismatches

| Dataset | Visible | Page | Current | Canonical | Folio ref | Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| 101 | 1 | 1 | B | E | 07BE7982 | ¿Cuál afirmación describe mejor una constante en programación? |
| 103 | 3 | 1 | E | B | 07BE7982 | Se pide validar que calif esté en el rango 0 a 100 (inclusive). ¿Cuál condición es CORRECTA para detectar que el valor es inválido? |
| 104 | 4 | 1 | D | C | 07BE7982 | Necesitas almacenar el grupo sanguíneo de una persona con un SOLO carácter (por ejemplo: 'A', 'B', 'O'). ¿Qué tipo de dato primitivo es el más adecuado? |
| 105 | 5 | 1 | E | B | 07BE7982 | Dados: x = 8, y = 3, z = 3. Evalúa la expresión lógica: (x >= 8) AND (y < 3 OR z = 3): |
| 106 | 6 | 1 | D | C | 07BE7982 | Dados a = 2, b = 3, c = 4, ¿cuál es el valor de la expresión a + b x c? |
| 202 | 10 | 2 | D | C | 07BE7982 | ¿Cuál estructura garantiza que el bloque de instrucciones se ejecute al menos una vez, aunque la condición sea falsa desde el inicio? |
| 204 | 12 | 2 | B | D | 07BE7982 | En pseudocódigo, ¿qué condición compara correctamente si x es igual a 10 (sin asignar)? |
| 206 | 14 | 2 | D | E | 07BE7982 | Se declara un arreglo bidimensional calif[3][5], donde fila = parcial (0..2) y columna = materia (0..4). ¿Cuál pseudocódigo recorre primero parciales (filas) y luego materias (columnas), sin salirse de rango? |
| 207 | 15 | 2 | B | C | 07BE7982 | Necesitas almacenar la cantidad de alumnos inscritos (un conteo: 0, 1, 2, 3, ...). ¿Qué tipo de dato es el más adecuado? |

## Matches

| Dataset | Visible | Page | Answer | Folio ref | Prompt |
| --- | --- | --- | --- | --- | --- |
| 102 | 2 | 1 | D | 07BE7982 | Se declara un arreglo de 5 enteros: int v[5]. En un esquema típico de índices desde 0, ¿cuál es el último índice válido? |
| 107 | 7 | 1 | D | 07BE7982 | Quieres almacenar calificaciones donde dimensión 1 = parcial (3 parciales: 0..2), dimensión 2 = materia (5 materias: 0..4), dimensión 3 = alumno (N alumnos: 0..N-1). ¿Cuál declaración representa mejor ese modelo? |
| 201 | 9 | 2 | D | 07BE7982 | En el contexto de pseudocódigo, ¿qué parte se considera el argumento de la sentencia de salida? Ejemplo: Imprimir "Hola" |
| 203 | 11 | 2 | D | 07BE7982 | ¿Cuántas veces se ejecuta el bloque si el ciclo es? Para i = 1 hasta 10 / (bloque) / FinPara |
| 205 | 13 | 2 | B | 07BE7982 | Si a es int y b es float, ¿qué tipo de dato suele tener el resultado de a + b en la mayoría de lenguajes? |
| 208 | 16 | 2 | C | 0E994CBA | Se requiere clasificar una calificación calif (0 a 100) así: Si calif >= 70 → "Aprobado", en caso contrario → "No aprobado". ¿Cuál bloque es el correcto? |
