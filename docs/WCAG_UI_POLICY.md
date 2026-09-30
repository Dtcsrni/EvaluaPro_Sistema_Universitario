# Política de accesibilidad WCAG de EvaluaPro

**Identificador de política:** `WCAG-UI-POLICY: 2.2-AA`  
**Estado:** obligatoria para frontend docente, alumno y administración.  
**Alcance:** cada elemento visible, textual, interactivo o informativo que se agregue o modifique.

## Regla principal

Ningún cambio de interfaz se considera terminado si no demuestra accesibilidad en sus
estados y temas aplicables. El aspecto glass, la transparencia, el blur, los gradientes
y los reflejos son decoración; el texto, los iconos funcionales, los límites de controles
y el foco deben conservar una superficie de respaldo legible y estable.

La referencia normativa es [WCAG 2.2](https://www.w3.org/TR/WCAG22/), con objetivo mínimo
de conformidad **Level AA**. Esta política es más estricta que una revisión visual informal:
un color no se aprueba por verse bien en una captura aislada.

## Criterios obligatorios por elemento

Para cada elemento nuevo o modificado se deben revisar todos los estados que existan:

- **Texto e imagen de texto:** mínimo `4.5:1`; texto grande, mínimo `3:1`.
- **Iconos funcionales, bordes que identifican controles, campos y estados:** mínimo
  `3:1` contra el color adyacente. El significado no puede depender solo del color.
- **Foco de teclado:** siempre visible, no eliminado por `outline: none`, con un indicador
  distinguible sobre fondos claros y oscuros. Se aplica también el contraste de contenido
  no textual de WCAG 1.4.11 y foco visible de WCAG 2.4.7.
- **Interacción:** nombre accesible, rol y estado correctos; operación completa con
  teclado; orden de foco lógico; mensajes de error asociados al campo; controles de icono
  con etiqueta.
- **Temas y estados:** validar claro y oscuro, así como `default`, `hover`, `active`,
  `focus-visible`, `disabled`, `loading`, `error`, `success` y `selected` cuando apliquen.
- **Responsive y movimiento:** sin pérdida de contenido a 320/360 px, zoom de texto al
  200 %, reflow, `prefers-reduced-motion` y sin información transmitida solo por animación.

## Política de iconografía para todas las páginas

Cada página nueva o modificada debe revisar dónde un icono ayuda a reconocer y recorrer la
interfaz: navegación, acciones, categorías, estados, indicadores, ayudas y estados vacíos.
Cuando aporte comprensión o rapidez visual, se debe incluir de forma consistente con el
sistema de iconos vectoriales de EvaluaPro; no se exige decorar elementos donde el icono
añada ruido o repita información.

El catálogo compartido debe tener variedad suficiente para representar con precisión los
dominios académicos, navegación, acciones, estados, fechas, archivos, datos y permisos. Se
prefieren símbolos semánticamente distintos a reutilizar un icono genérico para conceptos
que no comparten significado.

- Reutilizar `apps/frontend/src/ui/iconos.tsx` para los símbolos propios y consultar
  `docs/GUIA_ICONOGRAFIA.md` para los más de 1,600 iconos del catálogo Lucide. Preferir
  importaciones nombradas y el adaptador `IconoLucide` para conservar tree-shaking y
  accesibilidad.
- Acompañar los iconos con texto visible cuando la acción o estado no sea universal. Un
  icono no sustituye el nombre completo de un estado; abreviaturas como P/F/R/J son apoyo.
- Los controles solo con icono requieren nombre accesible y, cuando corresponda, tooltip.
  Los iconos decorativos se ocultan a tecnologías de asistencia; los informativos tienen
  alternativa textual y nunca transmiten significado solo por color.
- Mantener tamaño, alineación, trazo y significado coherentes entre páginas. Evitar emoji,
  caracteres Unicode y glifos de fuentes como sustitutos de iconos funcionales.
- Al incorporar una fuente nueva, verificar su licencia en el repositorio oficial, conservar
  el texto completo de licencia y registrar la procedencia. Importar solo los iconos que
  usa cada pantalla para conservar la carga bajo demanda y el tree-shaking.
- Revisar contraste, foco, tamaño táctil, responsive y ambos temas según esta política.

## Reglas específicas para glass

1. Los colores de texto y controles se consumen desde tokens semánticos; no se agregan
   colores locales sin registrar su contraste.
2. Toda superficie translúcida debe tener un fallback opaco equivalente para texto y
   controles. El cálculo se hace sobre el peor fondo efectivo, no sobre el color ideal.
3. `backdrop-filter`, sombras, glow y gradientes no cuentan como contraste por sí solos.
4. Un nuevo color crudo en CSS requiere un comentario `WCAG AA` junto al bloque y un par
   foreground/background verificable en `scripts/tests/ui-contrast-audit.mjs`; se prefieren
   variables semánticas.

## Guardrails automáticos

Estos controles son obligatorios y bloquean el cambio si fallan:

| Control | Qué evita | Ejecución |
| --- | --- | --- |
| ESLint `plugin:jsx-a11y/recommended` | Elementos sin nombre, rol, label, teclado o semántica básica | `npm -C apps/frontend run lint` |
| Auditoría de pares WCAG | Contraste insuficiente en tokens y estados registrados, en claro y oscuro | `node scripts/tests/ui-contrast-audit.mjs` |
| `wcag-guard` | Política ausente, contrato visual incompleto y nuevos colores CSS sin evidencia | `npm run guard:wcag` |
| Build docente | Publicar un bundle sin el guardrail de accesibilidad | `npm -C apps/frontend run build:docente` |
| CI frontend | Evitar que un PR omita la verificación | workflow `ci-frontend.yml` |

El guard de colores revisa las líneas nuevas de CSS en el diff. Las líneas con color crudo
fuera de un bloque documentado `WCAG AA` fallan. Esto evita que la deuda crezca aunque el
color parezca decorativo.

## Evidencia requerida en cambios de UI

El autor debe dejar evidencia de:

1. `npm run guard:wcag` y `npm -C apps/frontend run lint` en verde.
2. Capturas o revisión runtime de la pantalla modificada en tema claro y oscuro.
3. Recorrido de teclado de la ruta modificada: `Tab`, `Shift+Tab`, `Enter`, `Space` y
   `Escape` cuando correspondan.
4. Estados no vacíos: loading, empty, error y success cuando existan.
5. Revisión manual con lector de pantalla o herramienta equivalente para flujos críticos.

El guardrail automático no declara por sí solo conformidad WCAG completa: no sustituye la
prueba humana de lector de pantalla, zoom, reflow, foco, contenido dinámico ni uso real.

## Excepciones

No se aceptan excepciones silenciosas ni desactivación del guard. Una excepción temporal
debe documentar criterio WCAG afectado, elemento, riesgo, responsable, fecha de corrección
y evidencia alternativa; el cambio sigue requiriendo revisión humana y ticket trazable.

## Referencias normativas

- [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
