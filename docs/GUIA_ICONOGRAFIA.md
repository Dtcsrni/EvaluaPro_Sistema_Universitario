# Catálogo de iconos

EvaluaPro ofrece un solo catálogo de dibujos: Lucide, disponible desde
`apps/frontend/src/ui/iconosCatalogo.ts`. `Icono` en `apps/frontend/src/ui/iconos.tsx`
asigna nombres semánticos de producto a ese catálogo; `IconoLucide` permite usarlo
directamente. Ambos adaptadores aplican la misma escala y semántica accesible.

## Escala visual compartida

`Icono` y `IconoLucide` usan la misma familia de dibujos, trazo de 2 CSS px con extremos y
uniones redondeados. El tamaño
predeterminado es 20 px para ambos componentes. Las solicitudes de 12 a 32 px se ajustan al
nivel aprobado más cercano y cambian como máximo 2 px; por encima de 32 px se usa el múltiplo
de 4 más cercano:

- **14 y 16 px:** iconos compactos junto a estados o texto auxiliar.
- **20 px:** iconos de lectura y acciones comunes.
- **24 px:** iconos destacados de navegación o cabeceras.
- **28 y 32 px:** iconos de gran énfasis, como señal principal o marca de sección.

Usa un símbolo una sola vez por encabezado: no lo repitas en el título si ya aparece como
icono de sección destacado. El color permanece ligado al significado y contexto; usa
`currentColor` y tokens semánticos, no colores arbitrarios. Estas reglas no modifican SVG de
gráficos, documentos, ilustraciones o marcas que no sean iconos de interfaz.

Los iconos funcionales de la interfaz usan `Icono` o `IconoLucide`; no dibujes SVG de iconos
directamente dentro de una pantalla. Los SVG de gráficas, ilustraciones, documentos, QR y marcas
conservan su estilo propio y quedan fuera de esta regla. No agregues excepciones nuevas al catálogo
funcional; las pantallas no deben sustituir su trazo, familia ni escala.
Las clases específicas de una pantalla se agregan mediante `className`; los adaptadores conservan
siempre `icono` para que esos ajustes no eliminen la base compartida.
Los emblemas principales de las cabeceras de sección usan la clase `icono-seccion-orb`: caja de
52 × 52 px circular y glifo de 24 px. El acento y el color del glifo pueden variar por
dominio; la familia, la geometría y la superficie se mantienen compartidas.
La prueba de iconografía recorre todo `apps/frontend/src` y limita los SVG directos a
ilustraciones y excepciones nombradas (QR, gráfica circular e iconos de marca tecnológica).

## Uso

Importa solo los iconos que usa la pantalla. El catálogo es tree-shakeable, por lo que los
iconos no importados no se incluyen en el bundle final.

```tsx
import { CalendarDays, IconoLucide } from '../ui/iconosCatalogo';
import { Icono } from '../ui/iconos';

<IconoLucide icon={CalendarDays} size={18} />
<Icono nombre="ok" size={20} />
```

Los iconos decorativos se ocultan a tecnologías de asistencia por defecto. Para un icono
informativo que no tenga texto visible, proporciona `decorative={false}` y `label` en `IconoLucide`,
o `ariaHidden={false}` y `title` en `Icono`.
En controles de acción conserva un nombre accesible y texto visible cuando el símbolo no
sea universal.

Para adornos de campos se usa `IconoCampo` desde `ui/iconosCatalogo`; conserva una escala de
16 px, el mismo adaptador Lucide y semántica decorativa. No uses emoji en `content` CSS o como
prefijo de etiquetas, botones ni estados; las descripciones y confirmaciones deben seguir siendo
texto limpio.
Las flechas y cheurones que indiquen navegación, avance o expansión también se renderizan desde
`Icono` o `IconoLucide`; reserva los caracteres Unicode para texto con significado literal, como
rangos, fórmulas o cambios de valor. La prueba de iconografía detecta glifos usados como iconos.

## Licencia

Lucide React se distribuye bajo ISC e incluye el aviso MIT para los iconos derivados de
Feather. El aviso completo se muestra en la sección «Licencias» de la ventana de versión;
su texto fuente se conserva en `apps/frontend/src/ui/version/legal/lucide-react.LICENSE.txt`.
La versión instalada se registra en `apps/frontend/package.json` y `package-lock.json`.
