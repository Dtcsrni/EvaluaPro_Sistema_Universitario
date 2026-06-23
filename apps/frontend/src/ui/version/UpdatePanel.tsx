/**
 * UpdatePanel
 *
 * Responsabilidad: Componente/utilidad de UI reutilizable.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
import type { ReactElement } from 'react';

export type UpdatePanelStatus = {
  state: string;
  availableVersion?: string;
  lastError?: string;
  diffSummary?: {
    counts?: {
      releaseRelevantFiles?: number;
    };
  } | null;
  download?: {
    percent?: number;
  };
};

export type UpdatePanelProps = {
  status: UpdatePanelStatus;
  onCheck: () => void;
  onDownload: () => void;
  onApply: () => void;
  onCancel: () => void;
};

function isBusy(state: string) {
  return state === 'checking' || state === 'downloading' || state === 'applying';
}

export function UpdatePanel(props: UpdatePanelProps): ReactElement {
  const status = props.status || { state: 'idle' };
  const state = String(status.state || 'idle');
  const busy = isBusy(state);
  const pct = Number(status.download?.percent || 0);
  const relevantChanges = Number(status.diffSummary?.counts?.releaseRelevantFiles || 0);
  const summaryText = status.diffSummary
    ? `Cambios relevantes beta: ${relevantChanges}`
    : 'Sin resumen estructurado';

  return (
    <section aria-label="Panel de actualización">
      <h2>Actualización</h2>
      <p data-testid="update-state">Estado: {state}</p>
      <p data-testid="update-version">Versión: {status.availableVersion || '-'}</p>
      <p data-testid="update-progress">Descarga: {pct}%</p>
      <p data-testid="update-diff-summary">{summaryText}</p>
      <p data-testid="update-error">{status.lastError ? `Error: ${status.lastError}` : 'Sin errores'}</p>
      <button type="button" onClick={props.onCheck} disabled={busy}>Buscar</button>
      <button type="button" onClick={props.onDownload} disabled={busy || state !== 'available'}>Descargar</button>
      <button type="button" onClick={props.onCancel} disabled={state !== 'downloading'}>Cancelar</button>
      <button type="button" onClick={props.onApply} disabled={busy || state !== 'ready'}>Aplicar</button>
    </section>
  );
}
