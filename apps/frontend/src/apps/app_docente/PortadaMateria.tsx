import { useEffect, useId, useState } from 'react';
import { clienteApi } from './clienteApiDocente';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';

const MIME_PORTADA = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LIMITE_BYTES = 20 * 1024 * 1024;

export function useVistaPrevia(archivo: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!archivo) {
      setUrl(null);
      return;
    }
    const nuevaUrl = URL.createObjectURL(archivo);
    setUrl(nuevaUrl);
    return () => URL.revokeObjectURL(nuevaUrl);
  }, [archivo]);
  return url;
}

export function ImagenPortadaMateria({ periodoId, tienePortada }: { periodoId: string; tienePortada?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!tienePortada) {
      setUrl(null);
      return;
    }
    let activa = true;
    let urlCreada: string | null = null;
    void clienteApi.obtenerBinario(`/periodos/${encodeURIComponent(periodoId)}/portada`)
      .then((respuesta) => respuesta.blob())
      .then((blob) => {
        if (!activa) return;
        urlCreada = URL.createObjectURL(blob);
        setUrl(urlCreada);
      })
      .catch(() => {
        if (activa) setUrl(null);
      });
    return () => {
      activa = false;
      if (urlCreada) URL.revokeObjectURL(urlCreada);
    };
  }, [periodoId, tienePortada]);

  return (
    <div className={`materia-avatar${url ? ' materia-avatar--portada' : ''}`} aria-hidden="true">
      {url ? <img className="materia-avatar__imagen" src={url} alt="" onError={() => setUrl(null)} /> : <Icono nombre="periodos" />}
    </div>
  );
}

export function GestionPortadaMateria({
  periodoId,
  nombreMateria,
  tienePortada,
  onCambio,
  disabled = false
}: {
  periodoId: string;
  nombreMateria: string;
  tienePortada?: boolean;
  onCambio: () => void;
  disabled?: boolean;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [errorOperacion, setErrorOperacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const vistaPrevia = useVistaPrevia(archivo);
  const ayudaId = `portada-materia-ayuda-${useId()}`;
  const errorArchivoId = `portada-materia-error-${useId()}`;
  const estadoId = `portada-materia-estado-${useId()}`;

  function seleccionarArchivo(file?: File) {
    setErrorArchivo('');
    setErrorOperacion('');
    if (!file) {
      setArchivo(null);
      return;
    }
    if (!MIME_PORTADA.has(file.type.toLowerCase())) {
      setArchivo(null);
      setErrorArchivo('Selecciona una imagen JPG/JPEG, PNG o WebP.');
      return;
    }
    if (file.size > LIMITE_BYTES) {
      setArchivo(null);
      setErrorArchivo('La imagen no debe superar 20 MiB.');
      return;
    }
    setArchivo(file);
  }

  async function guardar() {
    if (!archivo || disabled || guardando) return;
    setGuardando(true);
    setErrorOperacion('');
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      await clienteApi.actualizarFormData(`/periodos/${encodeURIComponent(periodoId)}/portada`, formData);
      setArchivo(null);
      onCambio();
    } catch (cause) {
      setErrorOperacion(cause instanceof Error ? cause.message : 'No se pudo guardar la portada.');
    } finally {
      setGuardando(false);
    }
  }

  async function quitar() {
    if (disabled || guardando) return;
    setGuardando(true);
    setErrorOperacion('');
    try {
      await clienteApi.eliminar(`/periodos/${encodeURIComponent(periodoId)}/portada`);
      setArchivo(null);
      onCambio();
    } catch (cause) {
      setErrorOperacion(cause instanceof Error ? cause.message : 'No se pudo retirar la portada.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="materia-portada-editor">
      <label className="campo">
        <span>Portada de la materia</span>
        <span className="materia-portada-editor__selector">
          <span className="materia-portada-editor__selector-accion" aria-hidden="true">Elegir imagen</span>
          <span className="materia-portada-editor__selector-estado" id={estadoId} role="status" aria-live="polite" aria-atomic="true">
            {archivo?.name || (tienePortada ? 'Portada actual. Elige una imagen para reemplazarla.' : 'Ningún archivo seleccionado')}
          </span>
          <input
            className="materia-portada-editor__selector-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            aria-label={`Seleccionar imagen de portada para ${nombreMateria}`}
            aria-invalid={errorArchivo ? true : undefined}
            aria-describedby={errorArchivo ? `${estadoId} ${ayudaId} ${errorArchivoId}` : `${estadoId} ${ayudaId}`}
            onChange={(event) => seleccionarArchivo(event.currentTarget.files?.[0])}
            disabled={disabled || guardando}
          />
        </span>
      </label>
      {vistaPrevia && <img className="materia-portada-editor__preview" src={vistaPrevia} alt="Vista previa de la portada seleccionada" />}
      <div className="materia-portada-editor__acciones">
        <Boton
          type="button"
          variante="secundario"
          onClick={guardar}
          disabled={!archivo || disabled || guardando}
          cargando={guardando}
          aria-label={`Guardar portada para ${nombreMateria}`}
        >
          Guardar portada
        </Boton>
        {tienePortada && (
          <Boton
            type="button"
            variante="secundario"
            onClick={quitar}
            disabled={disabled || guardando}
            aria-label={`Retirar portada de ${nombreMateria}`}
          >
            Retirar portada
          </Boton>
        )}
      </div>
      {errorOperacion && <p className="materia-portada-editor__error" role="alert">{errorOperacion}</p>}
      {errorArchivo && <p className="materia-portada-editor__error" id={errorArchivoId} role="alert">{errorArchivo}</p>}
      <p className="materia-portada-editor__ayuda" id={ayudaId}>JPG/JPEG, PNG o WebP; máximo 20 MiB.</p>
    </div>
  );
}
