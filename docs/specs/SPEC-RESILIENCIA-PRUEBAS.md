# Especificación de Desarrollo: Resiliencia de Superficie de Pruebas

## 1. Objetivo
Garantizar que todos los módulos funcionales del docente (Evaluaciones, Asistencias, Integración Classroom) estén protegidos contra fallos asíncronos y transitorios (red, base de datos caída, tokens expirados), extendiendo la cobertura de las pruebas más allá del "Happy Path" mediante inyección de fallos.

## 2. Alcance (Prioridad Funcional Docente)
1. **Evaluaciones:** Soporte offline y desconexión durante guardado.
2. **Asistencias:** Inyección de bloqueos de tabla SQLite.
3. **Classroom:** Simulación de APIs externas caídas y tokens revocados durante sincronización.

## 3. Criterios de Aceptación
1. Todas las pruebas de resiliencia añadidas deben correr exitosamente en el pipeline de CI (
pm run qa:full).
2. El módulo de evaluaciones en el frontend no debe colapsar ante un error 500 del backend, sino mostrar un estado de "guardado pendiente" o mensaje amigable.
3. La cobertura global no debe decrecer.

## 4. Rastreabilidad
Vinculado a la optimización continua de UX y Arquitectura Limpia, regido por POLITICA_SDD.md.
