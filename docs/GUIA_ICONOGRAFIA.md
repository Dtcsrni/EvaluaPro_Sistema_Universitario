# Catálogo de iconos

EvaluaPro conserva sus símbolos de producto en `apps/frontend/src/ui/iconos.tsx` y ofrece
el catálogo Lucide completo (más de 1,600 iconos SVG) desde
`apps/frontend/src/ui/iconosCatalogo.ts`. El adaptador `IconoLucide` aplica tamaño y
semántica accesible coherentes con el sistema visual.

## Uso

Importa solo los iconos que usa la pantalla. El catálogo es tree-shakeable, por lo que los
iconos no importados no se incluyen en el bundle final.

```tsx
import { CalendarDays, IconoLucide } from '../ui/iconosCatalogo';

<IconoLucide icon={CalendarDays} size={18} />
```

Los iconos decorativos se ocultan a tecnologías de asistencia por defecto. Para un icono
informativo que no tenga texto visible, proporciona `decorative={false}` y `label`.
En controles de acción conserva un nombre accesible y texto visible cuando el símbolo no
sea universal.

## Licencia

Lucide React se distribuye bajo ISC e incluye el aviso MIT para los iconos derivados de
Feather. El aviso completo se muestra en la sección «Licencias» de la ventana de versión;
su texto fuente se conserva en `apps/frontend/src/ui/version/legal/lucide-react.LICENSE.txt`.
La versión instalada se registra en `apps/frontend/package.json` y `package-lock.json`.
