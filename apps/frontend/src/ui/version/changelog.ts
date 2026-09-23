export type EntradaChangelog = {
  version: string;
  fecha: string;
  grupos: Array<{ titulo: string; cambios: string[] }>;
};

const TITULOS_CATEGORIA: Record<string, string> = {
  added: 'Novedades',
  changed: 'Mejoras',
  deprecated: 'En retirada',
  fixed: 'Correcciones',
  removed: 'Retirado',
  security: 'Seguridad',
  verification: 'Verificación',
  notes: 'Notas'
};

function limpiarMarkdown(texto: string) {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function tituloCategoria(titulo: string) {
  const clave = titulo.split(/\s[-–—]\s/, 1)[0]?.trim().toLowerCase() || '';
  return TITULOS_CATEGORIA[clave] || limpiarMarkdown(titulo);
}

/** Convierte el subconjunto de Markdown de Keep a Changelog a una estructura segura para React. */
export function parsearChangelog(markdown: string): EntradaChangelog[] {
  const versiones: EntradaChangelog[] = [];
  let versionActual: EntradaChangelog | undefined;
  let grupoActual: EntradaChangelog['grupos'][number] | undefined;

  const asegurarVersion = () => {
    if (versionActual) return versionActual;
    versionActual = { version: 'Historial', fecha: '', grupos: [] };
    versiones.push(versionActual);
    return versionActual;
  };

  for (const lineaOriginal of String(markdown || '').replace(/\r/g, '').split('\n')) {
    const linea = lineaOriginal.trim();
    const encabezadoVersion = linea.match(/^##\s+\[([^\]]+)\](?:\s*[-–—]\s*(.+))?\s*$/)
      || linea.match(/^##\s+([^\s].*?)(?:\s*[-–—]\s*(\d{4}-\d{2}-\d{2}))?\s*$/);

    if (encabezadoVersion) {
      versionActual = {
        version: limpiarMarkdown(encabezadoVersion[1] || ''),
        fecha: String(encabezadoVersion[2] || '').trim(),
        grupos: []
      };
      versiones.push(versionActual);
      grupoActual = undefined;
      continue;
    }

    const encabezadoGrupo = linea.match(/^#{3,6}\s+(.+)$/);
    if (encabezadoGrupo) {
      grupoActual = { titulo: tituloCategoria(encabezadoGrupo[1]), cambios: [] };
      asegurarVersion().grupos.push(grupoActual);
      continue;
    }

    const viñeta = linea.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (viñeta) {
      if (!grupoActual) {
        grupoActual = { titulo: 'Cambios', cambios: [] };
        asegurarVersion().grupos.push(grupoActual);
      }
      grupoActual.cambios.push(limpiarMarkdown(viñeta[1]));
      continue;
    }

    if (linea && grupoActual?.cambios.length) {
      const indice = grupoActual.cambios.length - 1;
      grupoActual.cambios[indice] = `${grupoActual.cambios[indice]} ${limpiarMarkdown(linea)}`.trim();
    }
  }

  return versiones.filter((version) => version.grupos.some((grupo) => grupo.cambios.length > 0));
}

export function formatearFechaChangelog(valor: string) {
  const fecha = valor.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!fecha) return valor;
  const date = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(date.getTime())) return valor;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
