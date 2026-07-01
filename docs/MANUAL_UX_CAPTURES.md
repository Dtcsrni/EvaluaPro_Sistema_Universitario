# Manual UX/UI de EvaluaPro - Capturas de E2E

Este manual documenta el flujo visual de extremo a extremo, generado con capturas de prueba (Playwright) validadas contra los flujos principales de los usuarios. Las pruebas se realizaron asegurando que la interfaz esté limpia, pulida, sin variables expuestas (e.g., `#FFFFFF`), y que cumpla con los estándares visuales de la versión 1.1.1.

## 1. Dashboard Principal (Home)

Pantalla de bienvenida para los docentes con un diseño visual moderno, modo oscuro / cristalino ("glassmorphism"), donde pueden acceder a sus ciclos y crear o importar cursos rápidamente.

![Dashboard Home](assets/ui/01_dashboard.png)

## 2. Creación de Materia (Grupo)

Formulario validado sin elementos no deseados, mostrando un diseño limpio y moderno con una excelente legibilidad. 

![Creación de Materia](assets/ui/02_crear_materia.png)

## 3. Lista de Materias

Vista donde se confirman las materias creadas con su interfaz en forma de tarjeta o tabla.

![Lista de Materias](assets/ui/03_lista_materias.png)

## 4. Registro de Alumno

Flujo para añadir a los alumnos, mostrando inputs responsivos, un diseño accesible y notificaciones visuales correctas.

![Registro de Alumno](assets/ui/04_crear_alumno.png)

## 5. Lista de Alumnos

Pantalla donde se enlistan los alumnos ingresados validando su presentación y correcto despliegue visual de tabla / grid.

![Lista de Alumnos](assets/ui/05_lista_alumnos.png)

---

> **Nota Técnica**: Todas estas capturas fueron generadas de forma automática mediante la validación E2E en Playwright sobre los flujos críticos (ciclo completo). Esto confirma que las transiciones de UI son operativas, funcionales, atractivas, sin errores de renderizado.
