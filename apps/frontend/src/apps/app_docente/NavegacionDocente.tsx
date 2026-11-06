import { Fragment, useRef } from 'react';
import { Icono, type NombreIcono } from '../../ui/iconos';

type ItemVista = {
  id: string;
  grupo: string;
  label: string;
  icono: NombreIcono;
};

const ETIQUETAS_GRUPO: Record<string, string> = {
  academia: 'Academia',
  evaluacion: 'Evaluación',
  operacion: 'Operación'
};

const AYUDAS_VISTA: Record<string, string> = {
  periodos: 'Configura materias, fechas lectivas y grupos',
  periodos_archivados: 'Consulta materias archivadas de ciclos anteriores',
  alumnos: 'Gestión de alumnos, matrícula y listas',
  asistencias: 'Pase de lista diario y reportes institucionales',
  temarios: 'Planeación didáctica y temas de estudio',
  banco: 'Banco reactivo de preguntas y dificultad',
  plantillas: 'Diseña exámenes impresos con códigos QR y burbujas OMR',
  entrega: 'Control de entrega de exámenes impresos',
  calificaciones: 'Consulta resultados, captura calificaciones y revisa exámenes OMR',
  evaluaciones: 'Criterios y rúbricas de evaluación continua',
  classroom: 'Conexión de Google Classroom; consulta de datos en Calificaciones',
  sincronizacion: 'Sincronización y respaldo local / nube',
  cuenta: 'Perfil docente, licencia y preferencias'
};

export function NavegacionDocente({
  items,
  vista,
  onCambiarVista
}: {
  items: ItemVista[];
  vista: string;
  onCambiarVista: (id: string) => void;
}) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <nav
      className="tabs tabs--scroll tabs--sticky tabs--docente-responsive"
      aria-label="Secciones del portal docente"
    >
      <label className="tabs__mobile-picker" htmlFor="navegacion-docente-movil">
        <span>Ir a sección</span>
        <select
          id="navegacion-docente-movil"
          value={vista === 'periodos_archivados' ? 'periodos' : vista}
          onChange={(event) => onCambiarVista(event.currentTarget.value)}
        >
          {(['academia', 'evaluacion', 'operacion'] as const).map((grupo) => {
            const opciones = items.filter((item) => item.grupo === grupo);
            if (opciones.length === 0) return null;
            return (
              <optgroup key={grupo} label={ETIQUETAS_GRUPO[grupo]}>
                {opciones.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </optgroup>
            );
          })}
        </select>
      </label>
      {items.map((item, idx) => {
        const activa = vista === item.id || (vista === 'periodos_archivados' && item.id === 'periodos');
        const grupoAnterior = items[idx - 1]?.grupo;
        const etiquetaGrupo = ETIQUETAS_GRUPO[item.grupo] || item.grupo;
        const tooltipTexto = AYUDAS_VISTA[item.id] || `Ir a ${item.label}`;
        return (
          <Fragment key={item.id}>
            {grupoAnterior !== item.grupo ? <span className="tabs__group-label">{etiquetaGrupo}</span> : null}
            <button
              ref={(el) => {
                tabsRef.current[idx] = el;
              }}
              type="button"
              className={activa ? 'tab activa' : 'tab'}
              aria-current={activa ? 'page' : undefined}
              data-tooltip={tooltipTexto}
              title={tooltipTexto}
              data-icono-tab={item.icono}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const ultimo = items.length - 1;
                let idxNuevo = idx;
                if (event.key === 'ArrowLeft') idxNuevo = Math.max(0, idx - 1);
                if (event.key === 'ArrowRight') idxNuevo = Math.min(ultimo, idx + 1);
                if (event.key === 'Home') idxNuevo = 0;
                if (event.key === 'End') idxNuevo = ultimo;
                const nuevoId = items[idxNuevo]?.id;
                if (!nuevoId) return;
                onCambiarVista(nuevoId);
                requestAnimationFrame(() => tabsRef.current[idxNuevo]?.focus());
              }}
              onClick={() => onCambiarVista(item.id)}
            >
              <Icono nombre={item.icono} />
              {item.label}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
