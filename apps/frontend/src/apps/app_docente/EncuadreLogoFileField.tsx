import { useState, type ChangeEvent } from 'react';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';

const MENSAJE_ERROR_LECTURA = 'No se pudo leer el archivo. Selecciona otra imagen e inténtalo de nuevo.';

export function EncuadreLogoFileField({
  id,
  label,
  onRead
}: {
  id: string;
  label: string;
  onRead: (dataUrl: string) => void;
}) {
  const [error, setError] = useState('');
  const ayudaId = `${id}-ayuda`;
  const errorId = `${id}-error`;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError(MENSAJE_ERROR_LECTURA);
        return;
      }
      onRead(reader.result);
    };
    reader.onerror = () => setError(MENSAJE_ERROR_LECTURA);
    reader.readAsDataURL(file);
  };

  return (
    <label className="campo" htmlFor={id}>
      {label}
      <input
        id={id}
        type="file"
        accept="image/png, image/jpeg"
        onChange={handleChange}
        className="encuadre-file-input-field"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={`${ayudaId}${error ? ` ${errorId}` : ''}`}
      />
      <span className="ayuda" id={ayudaId}>Formato PNG o JPG.</span>
      {error && (
        <InlineMensaje tipo="error">
          <span id={errorId}>{error}</span>
        </InlineMensaje>
      )}
    </label>
  );
}
