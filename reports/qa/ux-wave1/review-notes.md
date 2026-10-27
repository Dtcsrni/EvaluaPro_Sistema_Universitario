# Revisión UX wave 1 — evidencia y estado

Fecha de actualización: 2026-10-27
Checkout: `codex/gui-ux-wave-20261026` (integración local)
Alcance aprobado: SPEC-125 (Materias, Calificaciones y Cuenta) y SPEC-126 UX (Alumnos). La auditoría sigue parcial; no se atribuye conformidad global.

## Hallazgos y cambios revisados

- **Navegación docente en móvil:** en la captura baseline, el selector estaba en la misma tira desplazable que las pestañas y desaparecía al recorrer hasta secciones a la derecha. En `apps/frontend/src/styles/screens.css`, hasta 1023 px el selector queda en un bloque de ancho completo, con objetivo táctil mínimo de 44 px; pestañas duplicadas se ocultan. Desde 1024 px se conserva la navegación de escritorio. Prueba de contrato añadida en `apps/frontend/tests/gui.responsive.contract.test.tsx`.
- **Métricas de Calificaciones:** a 583 px cinco tarjetas estaban comprimidas en una línea y una se envolvía a una fila segunda. Se usan columnas responsivas de mínimo 8 rem para mantener lectura y orden. Prueba de contrato añadida en `apps/frontend/tests/gui.responsive.contract.test.tsx`.
- **Verificación en ejecución:** en el navegador integrado, tras recargar el bundle publicado, el selector cambió a Calificaciones y mostró sus cinco vistas internas y cinco métricas. A 583 px, las métricas ocupan tres columnas y el documento mide 571 px, sin desbordamiento horizontal. Verificación de breakpoints previa: 320, 390, 571 y 1023 px para selector; a 1024 px se verifica ocultación del selector y presencia de las pestañas de escritorio.
- **Contrato E2E de navegación:** el recorrido anterior trataba tablet pequeña como escritorio, aunque el diseño cambia a selector a 1023 px, y suponía que el valor interno de Sincronización era igual a su slug de reporte. Se actualizó `tests/gui-responsive/responsive-docente.spec.ts` para validar selector y opción elegida en anchos <=1023 px, y botones con `aria-current="page"` desde 1024 px. El recorrido de las diez secciones pasó en 1920, 1024, 768 y 390 px (4/4) con Microsoft Edge instalado y puerto aislado 4183; no se aumentaron esperas.
- **Sincronización de artefactos locales:** `dist-alumno/index.html` del checkout, runtime primario y espejo raíz tienen el mismo SHA-256 (`F8761EB1526E9963AE47CF4498D697D2205B1EE02156937431B5B699A501A80F`). El docente se publicó mediante el script documentado de sincronización con respaldo y validación de bundle.

## Evidencia visual

Las capturas sin datos personales están en `reports/qa/ux-wave1/screenshots/`:

- `01-entrega.png`: entrega de examen.
- `02-materias.png` y `03-materias-form.png`: catálogo y formulario de materias.
- `04-alumnos.png`: encabezado y resumen de Alumnos; se excluyeron registros personales.
- `05-calificaciones.png`: encabezado y métricas antes del reflow.
- `06-nav-mobile-fixed.png` y `07-nav-320-calificaciones.png`: selector móvil posterior en 390 y 320 px.

La vista real de Calificaciones contiene nombres y matrículas; no se almacenó una captura posterior con esos datos. Se verificaron estado accesible y medidas computadas en el DOM.

## Validación ejecutada

- Focal frontend: `tests/gui.responsive.contract.test.tsx` y `tests/appDocente.secciones.test.tsx`; 18/18 pasan.
- Suite frontend completa: `npm run test:frontend:ci`, 469/469 pruebas.
- E2E responsive docente: `npm run test:gui:responsive:e2e:docente -- --grep "recorre pantallas operativas"` con `GUI_RESPONSIVE_PORT=4183` y `E2E_BROWSER_CHANNEL=msedge`; 4/4 viewports pasan.
- `npm run guard:wcag`: pasa, 33/33 pares de contraste registrados.
- `npm run typecheck`: pasa en backend, frontend y portal.
- Builds de docente y alumno: pasan; la guarda del bundle docente y contraste pasan.
- `npm run qa:full`: primera ejecución dentro del sandbox falló por `EACCES` al conectar puertos loopback efímeros; repetición elevada pasó todos los gates y manifiesto.
- `npm run test:ci`: lint, WCAG, typecheck y build pasaron en la primera ejecución; la validación de render de diagramas no pudo iniciar Chromium (`3221225506`). Repetición elevada avanzó y detectó un SVG C4 renderizado desactualizado (`docs/diagramas/rendered/c4/arquitectura-c4-context.svg`), por lo que la suite se detuvo ahí; no ejecutó los tests posteriores de `test:ci`.

## Límites y pendientes

- Las vistas y controles de Materias, Alumnos, Calificaciones y Cuenta requieren completar recorridos por teclado, tema claro y estados aplicables; no se declara WCAG conformidad global.
- Debe diagnosticarse el artefacto C4 desactualizado o su reproducibilidad antes de poder completar `npm run test:ci`.
- El job remoto `ux-visual-check` falló en su SHA anterior al esperar la pestaña visualmente oculta en tamaños <=1023 px. La aserción funcional se conservó y el test ahora sigue el control nativo realmente visible; el recorrido focal local pasó en los cuatro tamaños. El nuevo SHA debe volver a completar CI antes de integrar.
- La primera mejora de login Google con OAuth Desktop/PKCE y reparación de los espejos del runtime se documenta en SPEC-126 de autenticación; el E2E con proveedor Google/instalación limpia sigue pendiente.
- No se modificaron datos SQLite ni se guardaron identificadores de estudiantes, direcciones de correo o capturas que contengan registros personales en este informe.
