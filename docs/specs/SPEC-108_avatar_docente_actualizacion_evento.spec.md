---
id: SPEC-108
titulo: Actualizacion confiable del avatar docente por evento de perfil
version: 1.0.0
fecha: 2026-10-16
autor: Codex
modulo: frontend_docente
estado: approved
---

## Contexto

Durante la segunda corrida completa del CI Checks para el candidato 1.2.8, SHA `35452d595d02f654183b80cc11478dc3bcfddaf6`, falló una prueba de `Core Frontend`: `tests/appDocente.test.tsx > actualiza el avatar cuando cambia la foto local del docente actual`. El registro muestra que la aserción encontró `null` en lugar de un elemento `<img>`; 429 de 430 pruebas pasaron. La primera corrida completa del mismo SHA sí había terminado en verde. La evidencia indica un comportamiento intermitente, pero aún no determina si el evento de prueba se despachó antes de que el listener quedara listo o si hay una pérdida real de actualización en la GUI.

Después del fallo remoto, la suite `apps/frontend/tests/appDocente.test.tsx` pasó localmente completa (15/15). Esto confirma que el caso no falla de forma determinista en el entorno local; no invalida el fallo intermitente de CI ni sustituye las ejecuciones consecutivas requeridas.

El encabezado docente presenta una imagen local guardada en la cuenta y debe reflejar los cambios durante la sesión. La repetición focal local reprodujo la pérdida del evento: el botón con la identidad correcta estaba visible mientras el listener, instalado con `useEffect`, todavía no había quedado preparado. `ShellDocente` ahora carga la foto y conecta el listener con `useLayoutEffect`, antes de que el encabezado se pinte. Después del ajuste, el caso pasó 20 ejecuciones independientes consecutivas; la suite frontend completa pasó 430/430. La comprobación CI completa y visual sigue pendiente para el SHA candidato.

## Requisitos Funcionales

- **REQ-001:** Al estar montado el encabezado para un docente con ID conocido, un evento de actualización de foto para el mismo ID reemplazará el avatar visible con la foto indicada.
- **REQ-002:** Un evento para otro ID no cambiará el avatar del docente actual; un evento de limpieza de foto restaurará el avatar neutral conforme al contrato vigente.
- **REQ-003:** La prueba de integración del encabezado esperará una señal observable de que la sesión/identidad docente está lista y despachará el evento dentro de `act` de Testing Library. La aserción comprobará que el `<img>` esperado y su `src` aparecen en la GUI.
- **REQ-004:** Si la prueba revela una carrera de producción que pueda perder una actualización legítima después de que la cuenta esté lista, se corregirá el manejo del evento en el componente, preservando la identidad del docente, el orden de precedencia de imagen de cuenta/local y la respuesta neutral ante una imagen inválida.
- **REQ-005:** Se conservarán todas las pruebas frontend, suites E2E visuales, workers y umbrales del CI. La suite no aprobará por un reintento recuperado; el diagnóstico diferenciará fallo de aserción e inestabilidad de orden temporal.
- **REQ-006:** El gate completo incluirá la cobertura backend y los E2E funcionales/visuales aprobados de SPEC-102 y SPEC-103; la corrección debe pasar en el mismo SHA candidato en dos corridas completas consecutivas sin reintentos ocultos.

## Criterios de Aceptación

- La prueba reproduce el caso de cambio de foto local en la GUI con identidad docente explícita y verifica el `src` renderizado.
- Las pruebas de ID coincidente, ID distinto, limpieza y fallback neutral pasan sin depender del orden de otras pruebas.
- La prueba focalizada pasa 20 ejecuciones consecutivas sin modificación de concurrencia; después, la suite completa frontend pasa bajo la configuración normal del CI.
- No se eliminan pruebas, no se rebajan umbrales y no se habilitan reintentos que conviertan una ejecución inestable en verde.
- Dos corridas completas consecutivas del candidato corregido terminan en éxito en el SHA exacto, incluyendo cobertura backend completa y evidencia visual de UX/UI.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003, REQ-004 | Actualización del avatar con evento del mismo docente, aislamiento por identidad, limpieza y estado visible en GUI | `apps/frontend/tests/appDocente.test.tsx` | Verificado localmente; CI pendiente |
| REQ-005, REQ-006 | Suite frontend y gates completos conservados, sin aceptar recuperación por reintento | `.github/workflows/ci.yml`; `scripts/tests/ci-workflow-contract.test.mjs` | CI completo pendiente |
