import { Icono, type NombreIcono } from '../../ui/iconos';

export type VistaCalificaciones = 'resultados' | 'extraordinarios' | 'actas' | 'operacion' | 'classroom';

type OpcionVista = {
  id: VistaCalificaciones;
  textoSelector: string;
  titulo: string;
  descripcion: string;
  icono: NombreIcono;
};

const opcionesVista: OpcionVista[] = [
  { id: 'resultados', textoSelector: 'Resultados', titulo: 'Resultados', descripcion: 'Consulta por alumno', icono: 'calificar' },
  { id: 'extraordinarios', textoSelector: 'Extraordinarios', titulo: 'Extraordinarios', descripcion: 'Solicitud · examen · resultado', icono: 'evaluaciones' },
  { id: 'actas', textoSelector: 'Reportes y exportación', titulo: 'Reportes y exportación', descripcion: 'Genera y descarga reportes de calificaciones', icono: 'publicar' },
  { id: 'operacion', textoSelector: 'Revisión y captura', titulo: 'Revisión y captura', descripcion: 'OMR, manual y aclaraciones', icono: 'escaneo' },
  { id: 'classroom', textoSelector: 'Classroom', titulo: 'Classroom', descripcion: 'Vínculos · cortes · consulta', icono: 'classroom' }
];

export function CalificacionesWorkspaceNavigation({
  vista,
  onChange
}: {
  vista: VistaCalificaciones;
  onChange: (vista: VistaCalificaciones) => void;
}) {
  return (
    <nav className="calificaciones-workspace-nav" aria-label="Espacios de calificaciones">
      <label className="calificaciones-workspace-nav__mobile-label" htmlFor="calificaciones-espacio-movil">
        Espacio de calificaciones
      </label>
      <select
        className="calificaciones-workspace-nav__mobile-select"
        id="calificaciones-espacio-movil"
        value={vista}
        onChange={(event) => onChange(event.currentTarget.value as VistaCalificaciones)}
      >
        {opcionesVista.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.textoSelector}</option>)}
      </select>
      <div className="calificaciones-workspace-nav__desktop">
        {opcionesVista.map((opcion, index) => (
          <button
            key={opcion.id}
            type="button"
            className={vista === opcion.id ? 'is-active' : ''}
            aria-current={vista === opcion.id ? 'page' : undefined}
            onClick={() => onChange(opcion.id)}
          >
            <span className="calificaciones-workspace-nav__index">{String(index + 1).padStart(2, '0')}</span>
            <Icono nombre={opcion.icono} ariaHidden size={19} />
            <span><strong>{opcion.titulo}</strong><small>{opcion.descripcion}</small></span>
          </button>
        ))}
      </div>
    </nav>
  );
}
