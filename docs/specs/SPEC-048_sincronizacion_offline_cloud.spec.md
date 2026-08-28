---
id: SPEC-048
titulo: Sincronización de Paquetes Offline y Nube Institucional
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_sincronizacion
estado: implemented
---

## Contexto
Operación en entornos con conectividad limitada. Exportación de paquetes cifrados de datos, importación en servidor central y sincronización push/pull.

## Requisitos Funcionales
- **REQ-001 (Exportación de Paquetes)**: Generación de archivos cifrados con datos del curso.
- **REQ-002 (Importación y Fusión)**: Carga de paquetes sin colisión de identificadores.
- **REQ-003 (Sincronización Cloud)**: Empuje y descarga de registros hacia la nube institucional.

## Criterios de Aceptación
1. El docente puede exportar un paquete cifrado con el estado local de sus materias y evaluaciones.
2. La importación en otra estación o servidor fusiona registros respetando marcas de tiempo (LWW).
3. La sincronización maneja desconexiones y reintentos sin corromper datos.
4. Las pruebas de cliente API, paquetes de sincronización y contratos pasan en CI.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Exportación de paquetes offline y API | `apps/frontend/tests/clienteApi.test.tsx` | Completado |
| REQ-002 | Sección de paquetes de sincronización | `apps/frontend/tests/seccionPaqueteSincronizacion.test.tsx` | Completado |
| REQ-003 | Sincronización entre equipos y resiliencia | `apps/frontend/tests/seccionSincronizacionEquipos.test.tsx` | Completado |
