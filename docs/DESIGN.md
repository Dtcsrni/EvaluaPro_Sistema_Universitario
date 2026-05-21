# DESIGN.md - Installer Hub

Fuente de verdad visual y UX para el Installer Hub de EvaluaPro en Windows.

## Principios

- La UI debe comunicar estado operativo, no decorar. Cada bloque visible debe responder a una pregunta del usuario: que se hara, si el equipo esta listo, que esta pasando y como recuperarse.
- El flujo primario debe caber en pantallas de soporte comunes: 1024x768 a 100-125% DPI, con scroll solo para secciones avanzadas.
- El instalador debe ser usable con teclado, lector de pantalla y alto contraste. Todo control interactivo requiere nombre accesible, ayuda breve y orden de tabulacion predecible.
- El modo avanzado no debe bloquear el caso comun. Configuracion operativa, licencia y update viven colapsados por defecto.
- Los errores deben mostrar causa accionable y rutas de evidencia: paquete, codigo Windows, log MSI y log BA cuando existan.

## Layout Wizard Moderno

- Ventana objetivo: ancho inicial cercano a 1040 px, alto inicial cercano a 760 px, minimo menor o igual a 980x700.
- Estructura:
  - cabecera compacta con marca, version, modo y flavor;
  - stepper superior con cuatro pasos: Preparar, Revisar, Ejecutar y Resultado;
  - panel central de wizard con una tarea principal por pantalla;
  - bitacora tecnica persistente en expander inferior;
  - footer fijo con acciones.
- Tarjetas y paneles usan radio maximo 8 px. No se permiten fondos con orbes, blobs o formas decorativas sin funcion.
- Boton primario cambia por modo: `Instalar`, `Reparar` o `Desinstalar`. Botones secundarios: `Revisar equipo`, `Atrás`, `Siguiente`, `Reiniciar ahora`, `Cerrar`.
- Paleta moderna obligatoria: fondo neutro frio `#F6F8FA`, superficie `#FFFFFF`, texto `#111827`, primario institucional `#0F766E`, acento `#2563EB`, advertencia `#B45309`, error `#B42318`, correcto `#15803D`.
- Estilos reutilizables requeridos: `PrimaryButtonStyle`, `SecondaryButtonStyle`, `DangerButtonStyle`, `FieldLabelStyle`, `HelpTextStyle`, `StepCardStyle` y `StatusBadgeStyle`.

## Pasos del Wizard

- `Preparar`: flavor, modo, ruta, accesos y configuracion avanzada colapsada.
- `Revisar`: deteccion de prerequisitos, resumen accionable y tabla estable con scroll si aplica.
  - El Hub debe ser autonomo y adaptativo: ninguna sonda de `docker`, `wsl.exe` o prerequisito externo puede bloquear la UI sin timeout.
  - En `docente-local`, el runtime objetivo es `WSL2 + Docker Engine`; la ruta feliz no instala ni requiere `Docker Desktop`.
  - `Docker Desktop` queda como compatibilidad explicita si ya existe o si soporte la selecciona; no debe desplazar el bootstrap WSL2 de `docente-local` cuando su daemon no responde.
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
