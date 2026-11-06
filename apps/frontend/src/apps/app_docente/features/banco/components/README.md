# components

Submódulo de feature del frontend docente.

Ruta: `apps/frontend/src/apps/app_docente/features/banco/components`.

## Archivos clave
- `BancoAjustePreguntas.tsx`
- `BancoFormularioPregunta.tsx`
- `BancoGestionTemas.tsx`
- `BancoListadoPreguntas.tsx`
- `types.ts`

## Reglas de mantenimiento
- Mantener cambios pequeños y trazables con pruebas/validación asociada.
- Actualizar documentación relacionada cuando cambie el comportamiento observable.
- Evitar lógica de negocio profunda en componentes de presentación; preferir hooks/services.
- Los errores y estados deben conservar su severidad explícita; no inferirla del texto.
- Anunciar estados breves y dejar listas/controles extensos fuera de regiones vivas.
- Los errores de lectura deben diferenciarse de una lista vacía y ofrecer reintento cuando la operación sea recuperable.
- Mantener la semántica de preview/hash, revisión/publicación y los contratos del Banco al mejorar etiquetas o presentación.
