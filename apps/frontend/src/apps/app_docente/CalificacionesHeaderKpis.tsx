import { Icono } from '../../ui/iconos';

type VistaCalificaciones = 'resultados' | 'extraordinarios' | 'actas' | 'operacion' | 'classroom';

type Props = {
  vistaCalificaciones: VistaCalificaciones;
  resumenConsultaVigente: boolean;
  resumenConsulta: { total: number; calificados: number; pendientes: number };
  resumenExtraordinariosVigente: boolean;
  resumenExtraordinarios: { total: number | null };
  alumnosTotal: number;
  examenesListos: number;
  paginasPendientes: number;
  solicitudesTotal: number;
  totalPaginas: number;
};

export function CalificacionesHeaderKpis({
  vistaCalificaciones,
  resumenConsultaVigente,
  resumenConsulta,
  resumenExtraordinariosVigente,
  resumenExtraordinarios,
  alumnosTotal,
  examenesListos,
  paginasPendientes,
  solicitudesTotal,
  totalPaginas
}: Props) {
  return (
    <div className="banco-header-kpis">
      <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Alumnos registrados en las materias disponibles">
        <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="pdf" /></span>
        <span className="banco-mini-kpi__num">{vistaCalificaciones === 'resultados' ? (resumenConsultaVigente ? resumenConsulta.total : '—') : vistaCalificaciones === 'extraordinarios' ? (resumenExtraordinariosVigente ? resumenExtraordinarios.total : '—') : alumnosTotal}</span>
        <span className="banco-mini-kpi__lbl">{vistaCalificaciones === 'resultados' ? 'En la materia' : vistaCalificaciones === 'extraordinarios' ? 'En el periodo' : 'Alumnos'}</span>
      </div>

      <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip={vistaCalificaciones === 'resultados' ? 'Alumnos con una calificación registrada en la materia seleccionada' : 'Exámenes con calificación OMR confirmada'}>
        <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre={vistaCalificaciones === 'resultados' ? 'ok' : 'escaneo'} /></span>
        <span className="banco-mini-kpi__num banco-mini-kpi__num--cyan">{vistaCalificaciones === 'resultados' ? (resumenConsultaVigente ? resumenConsulta.calificados : '—') : examenesListos}</span>
        <span className="banco-mini-kpi__lbl">{vistaCalificaciones === 'resultados' ? 'Con calificación' : 'Confirmados'}</span>
      </div>

      <div className="banco-mini-kpi banco-mini-kpi--sintema anim-kpi-hover" data-tooltip={vistaCalificaciones === 'resultados' ? 'Alumnos sin calificación registrada en la materia seleccionada' : 'Páginas que necesitan revisión OMR'}>
        <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="alerta" /></span>
        <span className="banco-mini-kpi__num banco-mini-kpi__num--amber">{vistaCalificaciones === 'resultados' ? (resumenConsultaVigente ? resumenConsulta.pendientes : '—') : paginasPendientes}</span>
        <span className="banco-mini-kpi__lbl">{vistaCalificaciones === 'resultados' ? 'Sin calificación' : 'Revisión OMR'}</span>
      </div>

      <div className="banco-mini-kpi banco-mini-kpi--temaactual calificaciones-kpi--aclaraciones anim-kpi-hover" data-tooltip="Solicitudes de aclaración de alumnos">
        <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="aclaraciones" /></span>
        <span className="banco-mini-kpi__num banco-mini-kpi__num--purple">{solicitudesTotal}</span>
        <span className="banco-mini-kpi__lbl">Aclaraciones</span>
      </div>

      <div className="banco-mini-kpi banco-mini-kpi--reactivos anim-kpi-hover" data-tooltip="Páginas procesadas por el motor OMR">
        <span className="banco-mini-kpi__icon" aria-hidden="true"><Icono nombre="info" /></span>
        <span className="banco-mini-kpi__num">{totalPaginas}</span>
        <span className="banco-mini-kpi__lbl">Páginas OMR procesadas</span>
      </div>
    </div>
  );
}
