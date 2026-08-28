/**
 * PaginaFirmaEncuadre
 *
 * Responsabilidad: Componente/utilidad de UI reutilizable.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
import { useEffect, useState } from 'react';

type PaginaFirmaEncuadreProps = {
  token: string;
};

type FirmaDetalle = {
  id: string;
  rol: string;
  nombreFirmante: string;
  correo: string;
  firmado: boolean;
  firmadoEn?: string;
};

type EncuadreDetalle = {
  id: string;
  asignatura: string;
  carrera: string;
  cicloLectivo: string;
  horasDocente: number;
  creditos: number;
  estado: string;
};

export function PaginaFirmaEncuadre({ token }: PaginaFirmaEncuadreProps) {
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<{ firma: FirmaDetalle; encuadre: EncuadreDetalle } | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
  const pdfUrl = `${apiBase}/evaluaciones-publicas/encuadre/pdf/${token}`;

  useEffect(() => {
    let active = true;
    const fetchDetalles = async () => {
      try {
        const response = await fetch(`${apiBase}/evaluaciones-publicas/encuadre/firmar/${token}`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Error HTTP ${response.status}`);
        }
        const json = await response.json();
        if (active) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Error al cargar detalles de la firma');
          setLoading(false);
        }
      }
    };
    void fetchDetalles();
    return () => {
      active = false;
    };
  }, [token, apiBase]);

  const handleFirmar = async () => {
    setSigning(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/evaluaciones-publicas/encuadre/firmar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'No se pudo registrar la firma');
      }
      setSuccess(true);
      if (data) {
        setData({
          ...data,
          firma: { ...data.firma, firmado: true, firmadoEn: new Date().toISOString() }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al firmar el documento');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="encuadre-loading-container">
        <div className="encuadre-spinner"></div>
        <p>Cargando documento de encuadre académico...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="encuadre-error-container">
        <div className="encuadre-card">
          <div className="encuadre-error-icon">✕</div>
          <h2>Error de Acceso</h2>
          <p className="encuadre-error-msg">{error}</p>
          <p className="encuadre-error-sub">Por favor, verifique que el enlace recibido en su correo sea correcto.</p>
        </div>
      </div>
    );
  }

  const { firma, encuadre } = data!;

  return (
    <div className="encuadre-public-layout">
      <header className="encuadre-public-header">
        <div className="encuadre-header-brand">
          <span className="logo-badge">EP</span>
          <div>
            <h1>Conformidad de Encuadre Académico</h1>
            <p>Centro Universitario Hidalguense</p>
          </div>
        </div>
        {firma.firmado ? (
          <span className="status-badge status-badge--success">✓ Firmado Digitalmente</span>
        ) : (
          <span className="status-badge status-badge--pending">⌛ Pendiente de Firma</span>
        )}
      </header>

      <main className="encuadre-public-grid">
        <section className="encuadre-panel-info">
          <div className="encuadre-card">
            <h2>Detalles del Documento</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Asignatura</span>
                <span className="info-value info-value--highlight">{encuadre.asignatura}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Programa/Carrera</span>
                <span className="info-value">{encuadre.carrera}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Ciclo Lectivo</span>
                <span className="info-value">{encuadre.cicloLectivo}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Créditos / Horas</span>
                <span className="info-value">{encuadre.creditos} CR / {encuadre.horasDocente} Hrs</span>
              </div>
            </div>

            <div className="info-divider"></div>

            <h2>Sus Datos de Firma</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Nombre del Firmante</span>
                <span className="info-value">{firma.nombreFirmante}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Rol Académico</span>
                <span className="info-value font-uppercase">{firma.rol}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Correo Institucional</span>
                <span className="info-value">{firma.correo}</span>
              </div>
              {firma.firmado && (
                <div className="info-item">
                  <span className="info-label">Fecha de Firma</span>
                  <span className="info-value text-success">
                    {new Date(firma.firmadoEn!).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="alert alert--danger">
                <strong>Error: </strong> {error}
              </div>
            )}

            {success ? (
              <div className="success-panel">
                <div className="success-icon">✓</div>
                <h3>¡Firma Registrada Exitosamente!</h3>
                <p>Su conformidad con el encuadre académico ha sido estampada digitalmente.</p>
                <a href={pdfUrl} download={`Encuadre_${encuadre.asignatura}.pdf`} className="btn btn--secondary w-full">
                  Descargar PDF Firmado
                </a>
              </div>
            ) : (
              !firma.firmado && (
                <div className="action-panel">
                  <p className="signature-disclaimer">
                    Al presionar el botón, se estampará su nombre, dirección IP, fecha actual y un hash criptográfico de integridad en la página 2 de este documento oficial.
                  </p>
                  <button
                    onClick={handleFirmar}
                    disabled={signing}
                    className="btn btn--primary w-full btn-lg"
                  >
                    {signing ? (
                      <>
                        <span className="btn-spinner"></span> Registrando Firma Criptográfica...
                      </>
                    ) : (
                      'Firmar Encuadre Digital'
                    )}
                  </button>
                </div>
              )
            )}
            
            {firma.firmado && !success && (
              <div className="action-panel">
                <a href={pdfUrl} download={`Encuadre_${encuadre.asignatura}.pdf`} className="btn btn--secondary w-full">
                  Descargar PDF Firmado
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="encuadre-panel-pdf">
          <div className="pdf-viewer-header">
            <h3>Vista Previa del Documento Oficial</h3>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="pdf-external-link">
              Abrir en nueva pestaña ↗
            </a>
          </div>
          <div className="pdf-iframe-wrapper">
            <iframe src={pdfUrl} title="Vista previa del encuadre" className="pdf-iframe" />
          </div>
        </section>
      </main>
    </div>
  );
}
