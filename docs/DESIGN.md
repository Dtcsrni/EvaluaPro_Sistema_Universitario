# DESIGN.md - EvaluaPro UX/UI

Fuente de verdad visual y UX para las superficies operativas de EvaluaPro: frontend docente, portal alumno, admin negocio, Dashboard local e Installer Hub Windows.

## Principios

## Imagen de marca y tipografía

EvaluaPro debe comunicar confianza académica, claridad operativa y progreso. La referencia visual observada en el release (tema oscuro, azul eléctrico y superficies sobrias) se evoluciona hacia una identidad híbrida: azul petróleo/teal como acción y confianza, azul profundo como estructura, ámbar como logro y coral únicamente para riesgo.

- Texto principal: `Segoe UI Variable Text`, `Segoe UI`, `Aptos`, `Inter`, `system-ui`.
- Encabezados: `Segoe UI Variable Display`, `Segoe UI`, `Aptos Display`, `Aptos`.
- No depender de fuentes remotas: la aplicación instalada debe conservar legibilidad sin Internet.
- El texto corrido debe usar 16 px como base, altura de línea 1.5–1.6 y ancho aproximado de 65–75 caracteres.
- En Installer Hub nativo, ningún texto operativo visible debe bajar de 12 px; cuerpo secundario dinámico usa interlineado mínimo de 18 px, color claro sobre vidrio oscuro y `Wrap` antes que truncamiento horizontal.
- Contraste mínimo: 4.5:1 para texto normal y 3:1 para texto grande; estados de éxito, advertencia, error y progreso deben conservar texto legible aun con transparencia reducida o alto contraste.
- El contenido enriquecido debe preservar jerarquía semántica (`h1`–`h4`, listas, citas, código), saltos de línea y foco visible.
- Glassmorphism como material compuesto: Acrylic/Mica DWM, gradientes lineales discretos, reflejos y sombras de profundidad; conserva fallback, contraste WCAG 2.2, sin texto crítico dependiente solo de transparencia y con `prefers-reduced-motion`.

La imagen no debe copiar literalmente GitHub ni Windows; toma de ellos legibilidad, estados claros, densidad controlada y materiales con degradación segura.

- La UI debe comunicar estado operativo, no decorar. Cada bloque visible debe responder a una pregunta del usuario: que se hara, si el equipo esta listo, que esta pasando y como recuperarse.
- El flujo primario debe caber en pantallas comunes: desktop, tablet y mobile para web; 1024x768 a 100-125% DPI para soporte Windows. El scroll se reserva para contenido largo, no para corregir desorden visual.
- Cada pantalla debe tener una accion primaria evidente. Las acciones secundarias deben quedar cerca del contexto que modifican, sin competir con el flujo principal.
- Toda superficie debe ser usable con teclado, lector de pantalla y alto contraste. Todo control interactivo requiere nombre accesible, ayuda breve y orden de tabulacion predecible.
- La densidad debe ser operativa: suficiente informacion para decidir sin convertir la pantalla en landing page, dashboard decorativo o panel de tarjetas redundantes.
- La jerarquia visual debe ser simple, elegante y funcional: titulos legibles, espaciado estable, radios contenidos, gradientes lineales sobrios y reflejos de vidrio controlados. El Hub nativo puede usar halos gaussianos muy sutiles como atmosfera de fondo, sin competir con el contenido ni ocultar estados.
- El modo avanzado no debe bloquear el caso comun. Configuracion operativa, licencia y update viven colapsados por defecto.
- Los errores deben mostrar causa accionable y rutas de evidencia: paquete, codigo Windows, log MSI y log BA cuando existan.

## Superficies Web

- Frontend docente:
  - Navegacion por pestañas estable para Materias, Alumnos, Banco, Plantillas, Entrega, Calificaciones, Rehidratacion, Evaluaciones, Sincronizacion y Cuenta.
  - Cada pestaña debe sostener una tarea docente concreta: crear, revisar, publicar, importar, sincronizar o corregir.
  - Tablas, filtros y formularios deben mantener etiquetas visibles, mensajes inline y acciones CRUD predecibles.
- Portal alumno:
  - Acceso con codigo y matricula como unico flujo primario.
  - Resultados con resumen primero, folio/detalle despues y canales claros para revision, conformidad y PDF.
  - Sin ruido administrativo ni copy interno.
- Admin negocio:
  - Navegacion por vistas clara, metricas escaneables y acciones de soporte contenidas.
  - Tenants, licencias y cobranza deben distinguir consulta, alta y soporte sin mezclar estados comerciales con errores tecnicos.
- Dashboard local:
  - Estado runtime, broker, version, update y soporte privilegiado deben comunicar si el equipo esta listo antes de ofrecer acciones sensibles.
  - Logs y acciones avanzadas deben estar disponibles para soporte, pero no dominar la primera lectura.

## Contrato Visual Web

- Tokens principales viven en `apps/frontend/src/styles/foundations.css`; componentes compartidos en `components.css`; patrones de pantalla en `screens.css`.
- No se permiten `radial-gradient`, orbes, blobs, tracking negativo ni radios grandes en paneles principales.
- Los controles no deben solaparse materialmente en desktop, tablet o mobile.
- Los textos deben caber en su contenedor; si una etiqueta compite con el espacio disponible, debe envolver o reducir densidad sin ocultar informacion critica.
- Estados `loading`, `empty`, `error`, `warning` y `success` deben aparecer cerca del elemento afectado.
- Evidencia minima: `npm run test:gui:responsive:e2e:ci`, `npm run test:ux-quality:ci`, `npm run test:ux-visual:ci`, `npm run test:gui:design-contract` y `npm run test:gui:screen-matrix`.

## Layout Wizard Moderno

- Ventana objetivo: ancho inicial cercano a 1040 px, alto inicial cercano a 760 px, minimo menor o igual a 980x700.
- Estructura:
  - cabecera compacta con marca, version, modo y flavor;
  - stepper superior con cuatro pasos: Preparar, Revisar, Ejecutar y Resultado;
  - panel central de wizard con una tarea principal por pantalla;
  - bitacora tecnica persistente en expander inferior;
  - footer fijo con acciones.
- En la interfaz web, tarjetas y paneles usan radio maximo 8 px. El Hub nativo puede usar hasta 18 px en superficies de vidrio para reforzar profundidad, manteniendo controles y estados compactos. No se permiten fondos decorativos que oculten informacion o interfieran con interaccion.
- Boton primario cambia por modo: `Instalar`, `Reparar` o `Desinstalar`. Botones secundarios: `Revisar equipo`, `Atrás`, `Siguiente`, `Reiniciar ahora`, `Cerrar`.
- Paleta moderna obligatoria: fondo neutro frio `#F6F8FA`, superficie `#FFFFFF`, texto `#111827`, primario institucional `#0F766E`, acento `#2563EB`, advertencia `#B45309`, error `#B42318`, correcto `#15803D`.
- Estilos reutilizables requeridos: `PrimaryButtonStyle`, `SecondaryButtonStyle`, `DangerButtonStyle`, `FieldLabelStyle`, `HelpTextStyle`, `StepCardStyle` y `StatusBadgeStyle`.

## Pasos del Wizard

- `Preparar`: flavor, modo, ruta y accesos. La configuracion tecnica del flavor se resuelve con defaults internos; no debe exponerse como panel avanzado al usuario final.
- `Revisar`: deteccion de prerequisitos, resumen accionable y tabla estable con scroll si aplica.
  - El Hub debe ser autonomo y adaptativo: ninguna sonda de `docker`, `wsl.exe` o prerequisito externo puede bloquear la UI sin timeout.
  - En `docente-local`, el runtime objetivo es `WSL2 + Docker Engine`; la ruta feliz no instala ni requiere `Docker Desktop`.
  - Si el equipo del docente ya trae `Docker Desktop` instalado y sano, el Hub puede aceptarlo como runtime compatible para evitar doble runtime o conflictos locales.
  - Si `Docker Desktop` existe pero causa conflicto o su daemon no responde, no debe bloquear la ruta feliz: el Hub debe preferir/remediar `WSL2 + Docker Engine`.
  - `Docker Runtime Windows` significa runtime Docker operativo bajo el target efectivo del flavor.
  - `Node.js WSL2` es obligatorio para el target `WSL2 + Docker Engine`; solo se marca no requerido cuando se ha seleccionado compatibilidad `Docker Desktop` y el daemon esta sano.
- `Ejecutar`: progreso, etapa actual y linea de tareas.
- `Resultado`: estado final, reinicio si aplica y evidencia tecnica.
- El stepper debe mostrar texto de estado ademas de color: pendiente, activo, correcto, advertencia o error.

## Estados UX

- `install`: detecta prerequisitos, remedia si aplica, planifica Burn, ejecuta MSI, configura, verifica y finaliza.
- `repair`: conserva datos, revalida archivos/accesos/configuracion y vuelve a generar manifiesto.
- `uninstall`: retira producto y accesos; preserva datos/licencia/logs salvo confirmacion explicita de limpieza total.
- Desinstalacion estandar: no borra bases de datos, licencias, evidencia de soporte ni backups operativos.
- `update`: usa el mismo Hub versionado por flavor; siempre valida SHA256 y firma antes de ejecutar.
- Estados visuales permitidos: pendiente, activo, correcto, advertencia y error. No ocultar warnings en success.

## Accesibilidad

- Cada `Button`, `ComboBox`, `TextBox`, `CheckBox`, `ListView` y `ProgressBar` debe declarar `AutomationProperties.Name`.
- Controles con impacto operativo deben declarar `AutomationProperties.HelpText`.
- Botones principales deben tener access key con `_`.
- El foco inicial debe estar en la accion de revision o el primer selector operativo, nunca en un campo avanzado.
- High contrast debe conservar legibilidad; no depender solo de color para estado.

## Copy

- Usar espanol tecnico claro, orientado a accion.
- Evitar jerga de implementacion en la pantalla principal. `Burn`, `MSI` y `helper` pueden aparecer en detalle tecnico o docs.
- En errores, formato recomendado: `Que fallo. Que hacer ahora. Donde esta la evidencia.`

## Evidencia Requerida

- `npm run test:installer-hub:contract`
- `npm run test:wix:policy`
- `npm run test:update`
- `dotnet build packaging/wix/BurnBootstrapperApp/EvaluaPro.BurnBootstrapperApp.csproj -c Release --nologo`
- Smoke release Windows con bundle publico cuando exista artefacto en `dist/installer/**`.
