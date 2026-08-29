## Resumen del Cambio
- **Qué cambia:** 
- **Por qué es necesario:** 
- **Módulos afectados:** 

---

## Alineación con Spec-Driven Development (SDD)
- [ ] La especificación correspondiente en `docs/specs/*.spec.md` fue creada o actualizada.
- [ ] Los criterios de aceptación están formalizados y pasan en verde.
- [ ] Se ejecutó `npm run sdd:audit` y la validación fue exitosa (36+ specs válidas).

---

## Evidencia TDD y Calidad (Obligatoria)
- [ ] Agregué o ajusté pruebas antes o simultáneamente al cambio funcional.
- [ ] Se incluyó prueba de regresión para el comportamiento modificado.
- [ ] El `diff coverage` en líneas modificadas cumple el umbral (`>= 90%`).
- [ ] No introduje exclusiones nuevas de cobertura ni stubs vacíos.
- [ ] No se registraron credenciales, tokens ni datos personales sensibles.

---

## Batería de Gates Ejecutados
- [ ] `npm run lint` (0 errores, 0 advertencias)
- [ ] `npm run typecheck` (TypeScript estricto aprobado)
- [ ] `npm run test:backend:ci`
- [ ] `npm run test:frontend:ci`
- [ ] `npm run test:portal:ci`
- [ ] `npm run test:coverage:ci`
- [ ] `npm run test:tdd:enforcement:ci`
- [ ] `npm run perf:check` (4 presupuestos de rendimiento verificados)
- [ ] `npm run pipeline:contract:check`
- [ ] `npm run ci:policy:audit`

---

## Riesgos y Mitigaciones
- **Riesgos identificados:** Ninguno / (describir si aplica)
- **Plan de rollback / mitigación:** 
