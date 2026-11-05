---
id: SPEC-138
titulo: Claridad de estados en Rehidratación de paquetes
version: 1.0.8
fecha: 2026-10-31
autor: Codex / EvaluaPro Team
modulo: frontend_docente_rehidratacion_ux
estado: implemented
---

## Contexto

La pantalla docente de Rehidratación resume el estado de sus operaciones en la cabecera.
La revisión inicial encontró que «Paquetes detectados» podía mostrar `0` durante la carga
o al fallar, y «Resultado» podía anunciar recuperación antes de una operación. El resumen
ahora distingue carga, error, inventario cargado, operación no iniciada, verificación,
reconstrucción, conflicto y fallo; se conserva el comportamiento de recuperación existente.

El cambio propuesto limita el resumen a estados sustentados por la respuesta disponible:
inventario en consulta, inventario cargado con resultados, inventario vacío o consulta
fallida; y operación aún no ejecutada, verificación completada, reconstrucción completada,
conflicto o fallo. Se conservan los endpoints, permisos, datos, cálculos, y las reglas de
integridad e idempotencia de SPEC-075.

## Referencias de UX y accesibilidad

- W3C WAI, [WCAG 2.2 SC 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  los cambios de estado deben exponerse programáticamente sin requerir movimiento de foco.
- W3C WAI, [WCAG 2.2 SC 3.3.1 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html):
  los errores detectados deben comunicarse en texto. La pantalla ya usa `InlineMensaje`
  para errores; el resumen no debe ocultar ni contradecir ese estado.

## Requisitos Funcionales

- **REQ-138-001 Estado del inventario:** mientras se consulta la lista, el resumen no
  presentará `0` como conteo confirmado; indicará que está cargando. Solo mostrará cero
  o el conteo real después de una respuesta exitosa. Un fallo se distinguirá de un
  inventario vacío y conservará la recuperación existente.
- **REQ-138-002 Estado inicial de resultado:** antes de verificar o reconstruir, el resumen
  indicará que aún no se ejecuta una operación; no afirmará que reactivos, variantes o
  exámenes fueron recuperados.
- **REQ-138-003 Verificación y reconstrucción:** después de verificar, el resumen indicará
  que se verificó el paquete y que la verificación por sí sola no reconstruye registros.
  Solo una respuesta `reconstruida` podrá describir reconstrucción completada. Las
  respuestas `conflicto`, `fallida` y `verificada` conservarán estados distintos y no se
  presentarán como éxito de reconstrucción.
- **REQ-138-004 Anuncios accesibles:** los cambios dinámicos de carga y resultado se
  expondrán como mensajes de estado; los fallos mantendrán identificación textual y
  semántica de error. No se moverá el foco automáticamente.
- **REQ-138-005 Contratos e integridad:** no cambiar endpoints, payloads, permisos,
  selección de paquetes, reglas de firma, reconstrucción, persistencia, telemetría ni
  reglas funcionales de SPEC-075.
- **REQ-138-006 Densidad responsiva:** los resúmenes KPI propios de Rehidratación se
  mostrarán en dos columnas en pantallas estrechas, conservando etiquetas y valores
  legibles sin desbordamiento. En escritorio se conserva la distribución adaptable
  existente.
- **REQ-138-007 Ayuda secundaria:** el apoyo visual para lotes históricos permanecerá
  disponible, pero su explicación y acciones detalladas comenzarán plegadas bajo un
  resumen descriptivo. Usar `<details>/<summary>` nativos para conservar su divulgación
  accesible y operación por teclado; no plegar los controles principales de verificación
  o reconstrucción.
- **REQ-138-008 Instrucción del flujo:** explicar en lenguaje docente qué comprobará
  «Verificar paquete» y qué recuperará «Reconstruir lote», en ese orden. No mostrar los
  identificadores internos `recoveryBundle` ni `recoveryManifest` en la instrucción.
- **REQ-138-009 Resultado sin duplicación:** cuando el servidor devuelve una respuesta
  de verificación o reconstrucción, mostrar el resultado persistente de la sección sin
  duplicarlo en un toast flotante. Los errores de transporte o ejecución conservan la
  alerta inline y el toast de recuperación.

## Criterios de Aceptación

1. Durante la consulta inicial, el resumen no indica que hay cero paquetes confirmados.
2. Tras una respuesta vacía correcta se muestra un estado vacío; tras error se muestra
   error, no estado vacío.
3. Antes de una operación, el resultado no afirma que algo ya fue recuperado.
4. Una verificación exitosa se distingue claramente de una reconstrucción y no indica
   cambios de registros.
5. Solo `status: reconstruida` se describe como reconstrucción completada; conflicto,
   fallo y `verificada` permanecen diferenciados.
6. Los mensajes dinámicos conservan anuncios accesibles y no fuerzan movimiento de foco.
7. No cambian contratos ni reglas de SPEC-075.
8. La verificación visual en runtime debe registrar estados inicial, carga, vacío, error,
   verificación y reconstrucción con datos dummy; hasta capturarlos, no se declara
   completa la revisión visual.
9. A 320 y 390 CSS px, los grupos KPI de Rehidratación usan dos columnas, mantienen
   visibles sus textos y no generan desbordamiento horizontal.
10. El apoyo visual opcional aparece plegado al entrar, se puede abrir/cerrar con puntero
    y teclado, y conserva sus acciones y contenido.
11. La instrucción visible explica selección, verificación y reconstrucción con nombres de
    acciones coincidentes con los botones, sin exponer nombres internos de tipos.
12. Las respuestas recibidas de verificación y reconstrucción se comunican en el panel
    persistente una sola vez; los errores de ejecución siguen anunciándose como error.

## Validación focal prevista

- `apps/frontend/tests/seccionRehidratacionLotes.test.tsx`: estados de inventario inicial,
  cargando, vacío y error; resultado inicial; verificación sin reconstrucción; reconstrucción
  completada, conflicto y fallo.
- ESLint focal, typecheck frontend, `npm run guard:wcag` y `git diff --check`.
- No ejecutar suites de negocio/backend ajenas: este alcance solo cambia presentación de
  estados en frontend.

## Matriz de Trazabilidad

| ID Requisito | Descripción | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-138-001 | Conteo distingue carga, lista vacía, error y resultado cargado | `apps/frontend/tests/seccionRehidratacionLotes.test.tsx` | Implementado; estados de carga, vacío y error pasan en la prueba focal |
| REQ-138-002, REQ-138-003 | Resultado fiel a operación no iniciada, verificación, reconstrucción, conflicto o fallo | `apps/frontend/tests/seccionRehidratacionLotes.test.tsx` | Implementado; prueba focal diferencia estados y mensajes |
| REQ-138-004 | Estados accesibles, sin mover foco | `apps/frontend/tests/seccionRehidratacionLotes.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Mensajes de estado y alertas probados; capturas E2E de inventario y verificación |
| REQ-138-005 | Contratos y reglas de recuperación sin cambios | `apps/frontend/tests/seccionRehidratacionLotes.test.tsx` | Rutas y payloads existentes conservados; inspección focal |
| REQ-138-006 | Dos columnas KPI en viewport estrecho y textos legibles | `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; probado a 320 y 390 px |
| REQ-138-007 | Apoyo visual auxiliar plegado, disponible al expandir | `apps/frontend/tests/seccionRehidratacionLotes.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; apertura/cierre por teclado verificados |
| REQ-138-008 | Instrucción de verificación y reconstrucción sin identificadores internos | `apps/frontend/tests/seccionRehidratacionLotes.test.tsx` | Implementado y cubierto con prueba focal |
| REQ-138-009 | Resultado persistente sin toast duplicado; alertas de error conservadas | `apps/frontend/tests/seccionRehidratacionLotes.test.tsx` | Implementado; 16/16 pruebas focales PASS. Los errores de operación conservan alerta inline y toast |

### Validación visual focal (2026-10-29)

- Se capturó Rehidratación con un paquete sintético en tema claro/oscuro a 320 CSS px y tema oscuro a 390 px, antes y después de verificarlo. La cabecera muestra «Sin operación ejecutada» antes de actuar y «Verificado; sin reconstrucción» después; la respuesta aclara que verificar no reconstruye registros.
- Playwright focal `audita estados de Rehidratación con paquete sintético a 320 y 390 px`: 1/1 PASS. `tests/seccionRehidratacionLotes.test.tsx`: 16/16 PASS; ESLint focal PASS. Capturas inspeccionadas en `reports/qa/ux-rehidratacion-20261029-synthetic/`.
- Límite: la pantalla completa sigue siendo extensa en móvil; esta iteración valida estados y desbordamiento, no zoom 200 %, teclado manual ni lector de pantalla. No se usó el runtime ni datos reales.

### Revisión de densidad responsiva (2026-10-29)

- Las capturas iniciales mostraron cuatro métricas apiladas en una columna tanto en el resumen general como en el detalle del paquete. Se agregó REQ-138-006 para presentar estos datos en dos columnas en móvil, sin ocultarlos ni cambiar su contenido.
- Implementación: ambos grupos KPI usan dos columnas hasta 520 CSS px; las tarjetas ajustan su ancho y tipografía para evitar desbordamientos. E2E focal actualizado: 1/1 PASS a 320 y 390 px; capturas nuevas en `reports/qa/ux-rehidratacion-20261029-synthetic/`.
- La captura final conserva el orden de acciones y la información de cada paquete, con menor apilamiento vertical. El módulo visual auxiliar permanece abierto como opción de la sección; su iframe solo aparece cuando se solicita.
- Fuente para el patrón de divulgación: [WHATWG HTML Standard, `details`](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element) describe `details` como un control de divulgación de información o controles adicionales; [W3C WAI-ARIA APG, Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) define la activación con Enter/Espacio.
- La herramienta auxiliar ahora empieza plegada tras el resumen «Apoyo visual (opcional)». El recorrido E2E final verifica apertura con Enter y cierre con Espacio; al expandir mantiene descripción, URL, controles y opción de iframe. Las acciones principales permanecen visibles fuera del disclosure.
- Tras estos cambios: `seccionRehidratacionLotes.test.tsx` 16/16 PASS; recorrido E2E sintético final 1/1 PASS a 320/390 CSS px, con inspección de captura 320 px; ESLint focal, typecheck frontend, guard WCAG (46/46 pares), SDD y diff check PASS.

### Instrucciones del flujo en lenguaje docente (2026-10-29)

- Hallazgo: la ayuda visible exponía los identificadores internos `recoveryBundle` y `recoveryManifest` sin aportar significado al docente.
- Cambio: la instrucción ahora enlaza los botones «Verificar paquete» y «Reconstruir lote» con sus propósitos, en ese orden, y explica que la reconstrucción recupera banco, variantes y exámenes cuando el paquete es recuperable.
- Criterio editorial: lenguaje directo, orientado a la tarea y sin jerga innecesaria; la guía oficial de contenido claro recomienda usar términos comprensibles para la audiencia y explicar los técnicos cuando sean necesarios.
- No cambia estados, criterios de recuperabilidad, endpoints, permisos, reconstrucción ni contratos.

### Resultados de operación sin solapamiento (2026-10-29)

- La verificación y reconstrucción ya muestran su resultado en paneles persistentes; el toast flotante repetía el mismo contenido y podía cubrir elementos vecinos en escritorio.
- Se quitaron los toasts duplicados solo cuando la API devuelve una respuesta. Los fallos de ejecución conservan el mensaje inline y el toast global. No se alteran payloads, estado, permisos ni telemetría.
- Cobertura focal actualizada para verificar que el resultado permanece visible sin duplicarse en un toast.
- Validación: `npm -C apps/frontend test -- tests/seccionRehidratacionLotes.test.tsx` 16/16 PASS; `npm run sdd:audit` PASS; `git diff --check` terminó con código 0. El runtime `localhost:4173` rechazó la conexión en esta sesión, así que la inspección visual posterior a este cambio queda pendiente.

### Recorrido sintético de estados completos (2026-10-30)

- El E2E focal ahora verifica visualmente carga inicial, inventario vacío, error recuperable,
  reintento exitoso, paquete verificado y reconstrucción completada con datos sintéticos.
- `audita estados de Rehidratación con paquete sintético a 320 y 390 px`: 1/1 PASS;
  `seccionRehidratacionLotes.test.tsx`: 16/16 PASS. Capturas en
  `reports/qa/ux-rehidratacion-20261030-complete-states/`.
- Se inspeccionaron capturas de error y vacío a 320 px, y reconstrucción a 1440 px. Los KPIs
  se mantienen en dos columnas en móvil, los errores ofrecen reintento y la reconstrucción
  comunica su resultado y conteos. No se observó desbordamiento horizontal en estas vistas.
- Alcance de la evidencia: servidor E2E con API y usuario de prueba sintéticos. No valida la
  instalación local, permisos/datos reales, zoom al 200 %, lector de pantalla ni operación
  manual con teclado. Esas comprobaciones siguen pendientes antes de declarar conformidad
  completa de accesibilidad.

### Cierre de validación focal (2026-10-31)

- Playwright Edge con API/datos dummy: `audita estados de Rehidratación con paquete sintético a 320 y 390 px`, 1/1 PASS. Cubre 320, 390 y 1440 CSS px; carga, lista, vacío, error/reintento, verificación y reconstrucción; overflow, KPI compactos y ayuda operable con teclado.
- `seccionRehidratacionLotes.test.tsx`: 16/16 PASS.
- `npm run build:frontend:docente`: TypeScript, build, guard de bundle, ESLint y WCAG 61/61 PASS.
- `npm run sdd:audit`: PASS.
- Capturas revisadas en `reports/qa/ux-rehidratacion-current-goal-20261031/`. No se reprodujo solapamiento en el encabezado de escritorio. Se corrigieron los nombres de las capturas de vacío, error y reintento para indicar el tema oscuro real.
- No se validan la instalación local, servicios/lotes reales, zoom del 200 % ni lector de pantalla; por tanto, esta implementación no declara conformidad completa de accesibilidad.
