import type { ChangeEventHandler } from 'react';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import type { CalidadCaptura } from './QrAccesoMovil';

export function PanelCapturaIndividual({
  folio,
  onCambiarFolio,
  numeroPagina,
  onCambiarPagina,
  bloqueoManual,
  fuenteIdentificacion,
  onEditarManualmente,
  bloqueoAnalisis,
  archivoCapturaNombre,
  onSeleccionarArchivo,
  cargandoCaptura,
  calidadCaptura,
  motivosCaptura,
  ayudaAnalizarImagen,
  analizando,
  puedeAnalizar,
  puedeAnalizarImagen,
  onAnalizar
}: {
  folio: string;
  onCambiarFolio: (value: string) => void;
  numeroPagina: number;
  onCambiarPagina: (value: number) => void;
  bloqueoManual: boolean;
  fuenteIdentificacion: 'qr' | 'ocr' | null;
  onEditarManualmente: () => void;
  bloqueoAnalisis: boolean;
  archivoCapturaNombre: string;
  onSeleccionarArchivo: ChangeEventHandler<HTMLInputElement>;
  cargandoCaptura: boolean;
  calidadCaptura: CalidadCaptura | null;
  motivosCaptura: string[];
  ayudaAnalizarImagen: string | null;
  analizando: boolean;
  puedeAnalizar: boolean;
  puedeAnalizarImagen: boolean;
  onAnalizar: () => void;
}) {
  return (
    <div className="calif-captura-card">
      <div className="calif-captura-card__head">
        <span className="banco-section-pill">
          <span className="banco-section-pill__dot" aria-hidden="true" />
          <span>Escaneo Individual</span>
        </span>
        <span className="banco-counter-tag">Archivo</span>
      </div>
      <h3>Captura individual</h3>
      <div className="grid grid--2">
        <label className="campo">
          <span>Folio</span>
          <input
            value={folio}
            onChange={(event) => onCambiarFolio(event.target.value)}
            placeholder="Auto QR o manual"
            disabled={bloqueoManual || bloqueoAnalisis}
            className="calif-folio-input"
          />
        </label>
        <label className="campo">
          <span id="calif-pagina-label">Página</span>
          <input
            type="number"
            min={0}
            value={numeroPagina}
            onChange={(event) => onCambiarPagina(Number(event.target.value))}
            placeholder="0 = detectar QR"
            disabled={bloqueoManual || bloqueoAnalisis}
            aria-labelledby="calif-pagina-label"
            aria-describedby="calif-pagina-instrucciones"
          />
          <span id="calif-pagina-instrucciones" className="nota">
            0 intenta detectar el número con el QR. Para escribirlo manualmente, usa el número impreso en la hoja (desde 1).
          </span>
        </label>
      </div>
      {bloqueoManual && (
        <InlineMensaje tipo="info">
          {fuenteIdentificacion === 'ocr'
            ? 'QR no legible: folio/página recuperados por OCR del pie. Verifica la identidad en el original.'
            : 'QR detectado: se bloqueó el folio/página para evitar errores.'}
          <button type="button" className="link" onClick={onEditarManualmente}>
            Editar manualmente
          </button>
        </InlineMensaje>
      )}
      <div className="calif-dropzone-wrap">
        <label className="calif-dropzone">
          <span className="calif-dropzone__icon">
            <Icono nombre="escaneo" />
          </span>
          <span className="calif-dropzone__title">
            {archivoCapturaNombre ? 'Elegir otra imagen' : 'Cargar imagen o foto del examen'}
          </span>
          <span className="calif-dropzone__sub">Formatos JPG, PNG, WEBP de alta resolución</span>
          <input type="file" accept="image/*" onChange={onSeleccionarArchivo} disabled={bloqueoAnalisis || cargandoCaptura} className="calif-dropzone__input" />
        </label>
      </div>
      {archivoCapturaNombre && (
        <p className="calif-dropzone__filename">Archivo seleccionado: {archivoCapturaNombre}</p>
      )}
      {cargandoCaptura && <InlineMensaje tipo="info">Cargando la imagen y revisando su calidad…</InlineMensaje>}
      {calidadCaptura && (
        <InlineMensaje tipo={calidadCaptura.aprobada ? 'ok' : 'warning'}>
          {calidadCaptura.aprobada
            ? 'La imagen está lista para analizar.'
            : `Ajusta la imagen antes de analizarla. ${motivosCaptura.join(' ')}`}
        </InlineMensaje>
      )}
      {ayudaAnalizarImagen && (
        <p id="calif-captura-analizar-ayuda" className="calif-captura-action-help">
          {ayudaAnalizarImagen}
        </p>
      )}
      <div className="item-actions">
        <Boton
          type="button"
          icono={<Icono nombre="escaneo" />}
          cargando={analizando}
          disabled={!puedeAnalizar || !puedeAnalizarImagen || cargandoCaptura}
          aria-describedby={ayudaAnalizarImagen ? 'calif-captura-analizar-ayuda' : undefined}
          onClick={onAnalizar}
        >
          {analizando ? 'Analizando…' : 'Analizar página'}
        </Boton>
      </div>
    </div>
  );
}
