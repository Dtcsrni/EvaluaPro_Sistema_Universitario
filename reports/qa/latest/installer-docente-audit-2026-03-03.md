# Auditoría QA · Flujo Instalador + Experiencia Docente

Fecha: 2026-03-03  
Ámbito: Instalación Windows (Installer Hub), Dashboard operativo, actualización local y UX responsive del portal docente.

## Objetivo
Validar que el flujo completo desde la perspectiva del docente sea correcto, efectivo, eficiente, estético (UX/UI), confiable, seguro y robusto, con evidencia por pruebas (TDD).

## Cobertura evaluada
- Flujo Installer Hub: prerequisitos, descarga/verificación, ejecución MSI, configuración operativa, verificación final, blindaje de licencia.
- Integridad y seguridad local: SHA-256, DPAPI LocalMachine, baseline con MAC.
- Dashboard operativo: estado visual, alertamiento y acciones de actualización.
- UX docente responsive (Playwright): sección Calificaciones en 4 viewports.

## Cambios aplicados para robustez/TDD
1. **Cobertura de contrato ampliada para Installer Hub**
   - Archivo: `scripts/tests/installer-hub-contract.test.mjs`
   - Se agregaron pruebas para:
     - orden y códigos de salida de fases críticas,
     - fail-fast de configuración insegura,
     - persistencia de `.env` y `update-config.json` endurecido,
     - blindaje de licencia (DPAPI + MAC).

2. **Corrección de robustez real detectada en módulo de configuración**
   - Archivo: `scripts/installer-hub/modules/OperationalConfig.psm1`
   - Se corrigió lectura de claves opcionales bajo `Set-StrictMode` para evitar fallos por propiedades ausentes.
   - Se introdujo helper seguro de lectura por clave con default.

3. **Ajuste E2E docente a contrato UI vigente**
   - Archivo: `tests/gui-responsive/responsive-docente.spec.ts`
   - Se reemplazaron selectores desactualizados (`Calificar examen`, `Guardar calificación`) por elementos actuales de la UI:
     - `Escaneo y revisión OMR`,
     - `Selección manual por entregado`,
     - `Usar examen para calificación manual`.

## Evidencia de ejecución (comandos)
1. `node --test scripts/tests/installer-hub-contract.test.mjs`
   - Resultado: **9/9 pass, 0 fail**

2. `npm run test:dashboard:ui`
   - Resultado: **3/3 pass, 0 fail**

3. `npm run test:update`
   - Resultado: **8/8 pass, 0 fail**

4. `npm run test:gui:responsive:e2e:docente`
   - Resultado final: **4/4 pass, 0 fail**
   - Nota: inicialmente falló por selector desalineado con UI actual; se corrigió el test y se re-ejecutó exitosamente.

## Resultado consolidado
- Total ejecutado en esta auditoría: **24 pruebas**
- Estado global: **24 pass · 0 fail**

## Evaluación por criterio
- Correcto/efectivo: ✅ Flujo por fases con contratos explícitos y validaciones.
- Eficiente: ✅ Autodetección de prerequisitos y descarga/verificación automatizada.
- UX/UI: ✅ Navegación docente validada en desktop/tablet/mobile sin overflow horizontal.
- Confiable: ✅ Pruebas de contrato + UI + update en verde.
- Seguro: ✅ Verificación SHA-256, DPAPI LocalMachine, MAC de integridad.
- Robusto: ✅ Corregido defecto real de StrictMode en configuración opcional.

## Riesgos residuales / recomendaciones
- Mantener revisiones periódicas de selectores E2E cuando evolucione la UI semántica.
- Agregar este reporte al paquete de evidencia de release estable cuando aplique.
- Opcional: incorporar screenshot diff o snapshot accesible por viewport para detectar cambios visuales no funcionales.

## Conclusión
El flujo evaluado queda **aprobado** para los criterios solicitados, con respaldo de pruebas automatizadas y corrección de un hallazgo de robustez en configuración operativa.