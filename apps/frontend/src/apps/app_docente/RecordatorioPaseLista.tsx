import { Icono } from '../../ui/iconos';
import { IconoLucide, X } from '../../ui/iconosCatalogo';

export function RecordatorioPaseLista({
  mostrar,
  enAsistencias,
  onPasarLista,
  onCerrar
}: {
  mostrar: boolean;
  enAsistencias: boolean;
  onPasarLista: () => void;
  onCerrar: () => void;
}) {
  if (!mostrar) return null;

  return (
    <div className="banner-recordatorio-asistencia anim-fade-in">
      <span className="banner-recordatorio-asistencia__icon"><Icono nombre="asistencias" size={20} /></span>
      <span role="status" className="banner-recordatorio-asistencia__text">
        {enAsistencias ? (
          <><strong>Pase de lista pendiente.</strong> Aún no has pasado lista hoy.</>
        ) : (
          <strong>Pase de lista pendiente hoy.</strong>
        )}
      </span>
      <button type="button" onClick={onPasarLista} className="asistencias-btn-primario">
        Pasar lista
      </button>
      <button type="button" onClick={onCerrar} className="banner-recordatorio-asistencia__close scale-hover">
        <IconoLucide icon={X} size={18} />
        <span className="sr-only">Cerrar recordatorio</span>
      </button>
    </div>
  );
}
