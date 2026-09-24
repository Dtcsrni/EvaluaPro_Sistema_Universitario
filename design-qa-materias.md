# Design QA — Materias / vidrio esmerilado

## Referencias

- Fuente visual: `C:\Users\evega\AppData\Local\Temp\codex-clipboard-edaaa4b1-df9e-4138-9596-f070ca0d73cd.png`.
- Implementación: instalación local `http://127.0.0.1:4173/`, captura visual en navegador local, pestaña 3.
- Estado: docente autenticado, sección Materias, tema oscuro, dos materias activas.

## Comparación visual

- La referencia y la implementación conservan la misma jerarquía: navegación lateral, recordatorio superior, cabecera de Materias, métricas, tarjetas de materias y registro de nueva materia.
- La implementación revisada añade transparencia material visible en las tarjetas: base translúcida, desenfoque, saturación, borde refractivo, brillo lineal e iluminación interior.
- El contraste se reserva para los datos de consulta: títulos, porcentaje, fechas, grupos, contador de alumnos, nombres y CTA principal.
- Se evita volver a anidar cajas para cada elemento: los datos permanecen en una composición abierta; sólo las métricas y metadatos usan chips compactos.
- Iteración posterior: se eliminó el badge visible `OMR canónico · v4` del encabezado docente sin retirar el flujo OMR de Diseño de Exámenes; el perfil docente ahora usa grafito/teal mate, y se retiraron el avatar con `conic-gradient` y la animación de glow del chip de versión.
- Iteración actual: se eliminó la composición de cajas anidadas dentro de cada materia. Metadatos, alumnos y acceso principal ahora son flujo abierto dentro de la tarjeta exterior, con separadores y contraste tipográfico.

## Evidencia y límites

- Fuente: 2422 × 1247 px, mostrada en la conversación como 2048 × 1054 px.
- Implementación: captura CUA de 1280 × 720 px, densidad 1; se inspeccionó también la región desplazada de tarjetas para revisar alumnos y CTA.
- La comparación no es pixel a pixel porque la captura fuente y la ventana local tienen dimensiones distintas; se evaluó la superficie visual y la jerarquía en el mismo estado funcional.

## Verificaciones

- Build Vite de producción: aprobado.
- TypeScript: aprobado.
- ESLint con `--max-warnings=0`: aprobado.
- Pruebas frontend focalizadas: 2 archivos, 9 pruebas aprobadas.
- Instalación directa: el `index.html` instalado referencia el nuevo CSS generado y el navegador local mostró la vista actualizada.
- Accesibilidad visible: el encabezado conserva el botón de perfil docente, nombre, rol, estado y acciones de sesión; el badge OMR ya no aparece en el árbol accesible de la cabecera.
- Comparación de regresión: la captura CUA posterior conserva los dos cursos, porcentajes, fechas, grupos, listas de alumnos y controles de gestión; no se detectó pérdida funcional ni overflow en la tarjeta revisada.
- Iteración de botones: la captura posterior muestra una jerarquía coherente entre primarios minerales, secundarios translúcidos, chips informativos y navegación activa. Se eliminaron los gradientes/glows de botón que competían con el contenido; foco, hover, pressed, disabled y peligro mantienen estados distinguibles.

## Historial de hallazgos

- [P2] Primera iteración: las tarjetas internas seguían aparentando paneles independientes. Corrección: se eliminaron fondos, bordes y radios de meta, alumnos y CTA; evidencia posterior: tarjeta con una sola superficie y separadores abiertos.
- [P3] La comparación mantiene distintas dimensiones de captura entre la fuente y el navegador local. No bloquea la revisión porque la decisión evaluada es la jerarquía de superficies, no la coincidencia pixel a pixel.
- [P3] Los iconos de navegación conservan su color semántico por sección para facilitar orientación; el fondo y la geometría del botón permanecen unificados.

## Resultado

final result: passed
