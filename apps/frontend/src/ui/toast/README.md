# toast

Componentes y utilidades de UI reutilizables del frontend.

Ruta: `apps/frontend/src/ui/toast`.

## Archivos clave
- `toastBus.ts`
- `ToastProvider.tsx`

## Reglas de mantenimiento
- Mantener cambios pequeños y trazables con pruebas/validación asociada.
- Actualizar documentación relacionada cuando cambie el comportamiento observable.
- `emitToast` y `onToast` son el contrato público del bus; conservar los payloads existentes.
- Información y éxito se anuncian como `status`; los errores, como `alert`. Los controles quedan fuera de la región viva.
- Errores sin duración explícita y avisos con acciones persisten hasta cierre/acción; `persistent: false` permite una duración temporal explícita.
- El tiempo se pausa al pasar el puntero, recibir foco o quedar oculta la pestaña, y reanuda con el tiempo restante.
- Se muestran como máximo cuatro avisos a la vez en escritorio y uno en móvil (hasta 520 px). Los excedentes quedan en una cola FIFO indicada junto al aviso visible; su temporizador empieza cuando pasan a estar visibles. Actualizar el mismo `id` conserva una sola entrada, incluso si está en espera.
- En escritorio y móvil, la posición flotante se reevalúa con el foco, controles visibles, texto auxiliar, scroll y tamaño de ventana. Primero protege el foco y los controles; entre ubicaciones seguras, minimiza la porción de ayudas, etiquetas y estados que cubre. En móvil los avisos usan una tarjeta compacta; si todas las esquinas ocultarían por completo un control, se conserva el fallback en flujo del documento.
