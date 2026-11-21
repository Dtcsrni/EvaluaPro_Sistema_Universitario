import { Boton } from '../../../../../ui/ux/componentes/Boton';
import type { EstadoDescargaLote } from '../hooks/usePlantillasGeneradosActions';

export function PlantillasDescargaEstado({
  estado,
  esperaSegundos,
  ocupado,
  onReintentar
}: {
  estado: EstadoDescargaLote;
  esperaSegundos: number;
  ocupado: boolean;
  onReintentar: (loteId: string) => void;
}) {
  const titulo = {
    solicitando: `Solicitando PDF del lote ${estado.loteId}…`,
    descargando: `Descargando PDF del lote ${estado.loteId}…`,
    validando: `Validando archivo completo del lote ${estado.loteId}…`,
    solicitada: `Descarga del lote ${estado.loteId} solicitada al navegador`,
    error: `No se completó la descarga del lote ${estado.loteId}`
  }[estado.estado];

  return (
    <section className="plantillas-descarga-estado" aria-live="polite" aria-atomic="true" data-testid="estado-descarga-lote">
      <strong>{titulo}</strong>
      <span>Espera: {esperaSegundos} s</span>
      {estado.estado === 'descargando' && (
        <div>
          <progress
            aria-label={`Progreso de descarga del lote ${estado.loteId}`}
            max={estado.total}
            value={estado.total ? Math.min(estado.recibidos, estado.total) : undefined}
          />
          <span>
            {estado.recibidos.toLocaleString('es-MX')} bytes
            {estado.total ? ` de ${estado.total.toLocaleString('es-MX')}` : ' recibidos'}
          </span>
        </div>
      )}
      {estado.estado === 'error' && (
        <>
          <span>{estado.mensaje}</span>
          <Boton type="button" variante="secundario" disabled={ocupado} onClick={() => onReintentar(estado.loteId)}>
            Reintentar este lote
          </Boton>
        </>
      )}
      {estado.estado === 'solicitada' && <span>EvaluaPro entregó el archivo al navegador; la aplicación no puede confirmar que se guardó en Descargas.</span>}
    </section>
  );
}
