import { createHash } from 'node:crypto';

function serializarCanonico(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(serializarCanonico).join(',')}]`;
  if (value && typeof value === 'object') {
    const entradas = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entradas.map(([key, item]) => `${JSON.stringify(key)}:${serializarCanonico(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function calcularPlanHashImportacionClassroom(payload: unknown, preview: unknown): string {
  const previewEstable = { ...(preview as Record<string, unknown>) };
  delete previewEstable.importacionId;
  delete previewEstable.snapshotsClassroomGuardados;
  return createHash('sha256')
    .update(serializarCanonico({ payload, preview: previewEstable }))
    .digest('hex');
}
