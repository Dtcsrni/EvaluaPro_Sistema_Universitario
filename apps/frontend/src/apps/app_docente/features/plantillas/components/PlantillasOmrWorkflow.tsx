import { useMemo, useState } from 'react';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../../../../ui/ux/componentes/InlineMensaje';
import type { GeneratedAssessmentDetalle, OmrJobDetalle } from '../../../tipos';

type Props = {
  assessmentDetalle: GeneratedAssessmentDetalle | null;
  jobOmr: OmrJobDetalle | null;
  cargandoAssessmentId: string | null;
  procesandoOmr: boolean;
  descargarArtifact: (url: string | undefined, fileName: string) => Promise<void>;
  crearJobOmr: (args: { assessmentId: string; files: File[]; sourceType: 'image_batch' | 'camera_capture' | 'pdf' }) => Promise<void>;
  resolverHojaOmr: (args: {
    jobId: string;
    sheetSerial: string;
    resolutionReason: string;
    finalIdentity?: Record<string, unknown>;
    finalResponses?: Array<{ numeroPregunta: number; opcion: string | null }>;
    overrides?: Record<string, unknown>;
  }) => Promise<void>;
  finalizarJobOmr: (jobId: string) => Promise<void>;
};

type DraftHoja = {
  studentId: string;
  versionCode: string;
  responses: Array<{ numeroPregunta: number; opcion: string | null }>;
};

function construirDraftHoja(pagina: OmrJobDetalle['pages'][number] | null): DraftHoja {
  if (!pagina) {
    return { studentId: '', versionCode: '', responses: [] };
  }

  return {
    studentId: String(pagina.identityResult?.studentId ?? ''),
    versionCode: String(pagina.versionResult?.versionCode ?? ''),
    responses: Array.isArray(pagina.responses)
      ? pagina.responses.map((item) => ({
          numeroPregunta: Number(item.numeroPregunta),
          opcion: typeof item.opcion === 'string' ? item.opcion : null
        }))
      : []
  };
}

export function PlantillasOmrWorkflow({
  assessmentDetalle,
  jobOmr,
  cargandoAssessmentId,
  procesandoOmr,
  descargarArtifact,
  crearJobOmr,
  resolverHojaOmr,
  finalizarJobOmr
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [sheetSerialActivo, setSheetSerialActivo] = useState<string | null>(null);
  const paginaActiva = useMemo(
    () => (Array.isArray(jobOmr?.pages) ? jobOmr!.pages.find((page) => page.sheetSerial === sheetSerialActivo) ?? null : null),
    [jobOmr, sheetSerialActivo]
  );
  const [draftsPorHoja, setDraftsPorHoja] = useState<Record<string, DraftHoja>>({});
  const [resolutionReason, setResolutionReason] = useState('Corrección manual de hoja OMR V1');
  const draftActivo = useMemo(() => {
    if (!paginaActiva) return construirDraftHoja(null);
    const sheetSerial = String(paginaActiva.sheetSerial || '').trim();
    const existente = draftsPorHoja[sheetSerial];
    return existente ?? construirDraftHoja(paginaActiva);
  }, [draftsPorHoja, paginaActiva]);

  if (!assessmentDetalle) {
    return (
      <div className="resultado">
        <h4>Flujo OMR V1</h4>
        <InlineMensaje tipo="info">Genera o carga un assessment V1 para descargar artefactos y operar escaneo/revisión.</InlineMensaje>
      </div>
    );
  }

  return (
    <div className="resultado plantillas-omr-v1">
      <h4>Flujo OMR V1</h4>
      {cargandoAssessmentId && <InlineMensaje tipo="info">Cargando detalle de assessment…</InlineMensaje>}
      <div className="item-meta">
        <span>Folio: {assessmentDetalle.assessment.folio}</span>
        <span>Seed: {assessmentDetalle.assessment.generationSeed || '-'}</span>
        <span>Versiones: {assessmentDetalle.assessment.statisticsSummary.versionCount}</span>
        <span>Hojas: {assessmentDetalle.assessment.statisticsSummary.sheetCount}</span>
        <span>Packets: {assessmentDetalle.assessment.statisticsSummary.studentPacketCount}</span>
      </div>
      {Array.isArray(assessmentDetalle.assessment.versionSet) && assessmentDetalle.assessment.versionSet.length > 0 && (
        <div className="item-meta">
          {assessmentDetalle.assessment.versionSet.map((version) => (
            <span key={`${assessmentDetalle.assessment._id}-${version.versionCode}`}>
              Versión {version.versionCode}: {version.questionCount} reactivos
            </span>
          ))}
        </div>
      )}
      {Array.isArray(assessmentDetalle.studentPacketArtifacts) && assessmentDetalle.studentPacketArtifacts.length > 0 && (
        <div className="resultado">
          <h4>Packets emitidos</h4>
          <ul className="lista">
            {assessmentDetalle.studentPacketArtifacts.map((packet) => (
              <li key={`${packet.sheetSerial}-${packet.studentId || 'na'}`}>
                <b>{packet.sheetSerial}</b> · {packet.studentName || 'Alumno sin nombre'} · {packet.studentId || 'Sin ID'} · Versión {packet.versionCode}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="acciones acciones--mt">
        <Boton type="button" variante="secundario" onClick={() => void descargarArtifact(assessmentDetalle.assessment.bookletPdfUrl, `${assessmentDetalle.assessment.folio}_booklet_v1.pdf`)}>
          Descargar cuadernillo
        </Boton>
        <Boton type="button" variante="secundario" onClick={() => void descargarArtifact(assessmentDetalle.assessment.omrSheetPdfUrl, `${assessmentDetalle.assessment.folio}_omr_sheet_v1.pdf`)}>
          Descargar hoja OMR
        </Boton>
        <Boton type="button" variante="secundario" onClick={() => void descargarArtifact(assessmentDetalle.assessment.answerKeyUrl, `${assessmentDetalle.assessment.folio}_answer_key_v1.json`)}>
          Descargar answer key
        </Boton>
        <Boton type="button" variante="secundario" onClick={() => void descargarArtifact(assessmentDetalle.assessment.manifestUrl, `${assessmentDetalle.assessment.folio}_manifest_v1.json`)}>
          Descargar manifest
        </Boton>
        <Boton
          type="button"
          variante="secundario"
          disabled={!assessmentDetalle.assessment.studentPacketZipUrl}
          onClick={() => void descargarArtifact(assessmentDetalle.assessment.studentPacketZipUrl, `${assessmentDetalle.assessment.folio}_student_packets_v1.zip`)}
        >
          Descargar packets ZIP
        </Boton>
      </div>

      <div className="acciones acciones--mt">
        <label className="campo">
          Capturas o PDF
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </label>
        <Boton
          type="button"
          variante="secundario"
          cargando={procesandoOmr}
          disabled={files.length === 0}
          onClick={() =>
            void crearJobOmr({
              assessmentId: assessmentDetalle.assessment._id,
              files,
              sourceType: files.some((file) => file.type === 'application/pdf') ? 'pdf' : 'image_batch'
            })
          }
        >
          Procesar capturas
        </Boton>
      </div>
      {files.some((file) => file.type === 'application/pdf') && <InlineMensaje tipo="info">El backend rasterizará cada página del PDF y la procesará como hoja OMR individual.</InlineMensaje>}

      {jobOmr && (
        <>
          <div className="resultado plantillas-omr-v1__job">
            <h4>Job OMR</h4>
            <div className="item-meta">
              <span>Estado: {jobOmr.status}</span>
              <span>Aceptadas: {jobOmr.summary?.accepted ?? 0}</span>
              <span>Revisión: {jobOmr.summary?.needsReview ?? 0}</span>
              <span>Rechazadas: {jobOmr.summary?.rejected ?? 0}</span>
              <span>Auto: {jobOmr.summary?.autoGradable ?? 0}</span>
              <span>Promedio: {jobOmr.summary?.averageScore ?? 0}%</span>
            </div>
            <div className="plantillas-omr-v1__pages">
              {jobOmr.pages.map((page) => (
                <button
                  key={`${page.sheetSerial}-${page.pageIndex}`}
                  type="button"
                  className={`badge ${sheetSerialActivo === page.sheetSerial ? 'badge-activo' : ''}`}
                  onClick={() => setSheetSerialActivo(page.sheetSerial)}
                >
                  {page.sheetSerial} · P{page.pageIndex} · {page.scanStatus}
                </button>
              ))}
            </div>
            <div className="acciones acciones--mt">
              <Boton
                type="button"
                variante="secundario"
                cargando={procesandoOmr}
                disabled={!jobOmr.jobId}
                onClick={() => void finalizarJobOmr(jobOmr.jobId)}
              >
                Finalizar job
              </Boton>
            </div>
          </div>

          {paginaActiva && (
            <div className="resultado plantillas-omr-v1__review">
              <h4>Review & Fix: {paginaActiva.sheetSerial}</h4>
              <div className="item-meta">
                <span>Estado: {paginaActiva.scanStatus}</span>
                <span>Confianza: {(paginaActiva.confidence * 100).toFixed(1)}%</span>
                <span>Auto: {paginaActiva.autoGradable ? 'Sí' : 'No'}</span>
              </div>
              {paginaActiva.exceptions.length > 0 && (
                <ul className="lista">
                  {paginaActiva.exceptions.map((exception, index) => (
                    <li key={`${paginaActiva.sheetSerial}-${exception.code}-${index}`}>
                      <b>{exception.code}</b>: {exception.message}
                    </li>
                  ))}
                </ul>
              )}
              <div className="plantillas-omr-v1__review-grid">
                <label className="campo">
                  Student ID
                  <input
                    value={draftActivo.studentId}
                    onChange={(event) => {
                      const serial = String(paginaActiva.sheetSerial || '').trim();
                      if (!serial) return;
                      setDraftsPorHoja((prev) => ({
                        ...prev,
                        [serial]: { ...draftActivo, studentId: event.target.value }
                      }));
                    }}
                  />
                </label>
                <label className="campo">
                  Versión
                  <input
                    value={draftActivo.versionCode}
                    onChange={(event) => {
                      const serial = String(paginaActiva.sheetSerial || '').trim();
                      if (!serial) return;
                      setDraftsPorHoja((prev) => ({
                        ...prev,
                        [serial]: { ...draftActivo, versionCode: event.target.value.toUpperCase() }
                      }));
                    }}
                    maxLength={4}
                  />
                </label>
                <label className="campo">
                  Motivo
                  <input value={resolutionReason} onChange={(event) => setResolutionReason(event.target.value)} />
                </label>
              </div>
              <div className="plantillas-omr-v1__responses">
                {draftActivo.responses.map((response, index) => (
                  <label key={`${paginaActiva.sheetSerial}-${response.numeroPregunta}`} className="campo">
                    P{response.numeroPregunta}
                    <select
                      value={response.opcion ?? ''}
                      onChange={(event) => {
                        const serial = String(paginaActiva.sheetSerial || '').trim();
                        if (!serial) return;
                        const siguiente = draftActivo.responses.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, opcion: event.target.value || null } : item
                        );
                        setDraftsPorHoja((prev) => ({
                          ...prev,
                          [serial]: { ...draftActivo, responses: siguiente }
                        }));
                      }}
                    >
                      <option value="">Sin marca</option>
                      {['A', 'B', 'C', 'D', 'E'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="acciones acciones--mt">
                <Boton
                  type="button"
                  variante="secundario"
                  cargando={procesandoOmr}
                  onClick={() =>
                    void resolverHojaOmr({
                      jobId: jobOmr.jobId,
                      sheetSerial: paginaActiva.sheetSerial,
                      resolutionReason,
                      finalIdentity: { studentId: draftActivo.studentId },
                      finalResponses: draftActivo.responses,
                      overrides: { versionCode: draftActivo.versionCode }
                    })
                  }
                >
                  Guardar resolución
                </Boton>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
