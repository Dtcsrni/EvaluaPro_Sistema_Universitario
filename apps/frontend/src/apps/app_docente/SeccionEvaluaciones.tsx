import { useCallback, useEffect, useMemo, useState } from 'react';
import { emitToast } from '../../ui/toast/toastBus';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import type { Alumno, Periodo } from './tipos';

type TabEvaluaciones = 'politica' | 'evidencias' | 'examenes' | 'classroom' | 'resumen';

type Politica = {
  codigo: 'POLICY_SV_EXCEL_2026' | 'POLICY_LISC_ENCUADRE_2026';
  version: number;
  nombre: string;
};

type ResumenEvaluacion = {
  politicaCodigo?: string;
  politicaVersion?: number;
  continuaPorCorte?: { c1?: number; c2?: number; c3?: number };
  examenesPorCorte?: { parcial1?: number; parcial2?: number; global?: number };
  bloqueContinuaDecimal?: number;
  bloqueExamenesDecimal?: number;
  finalDecimal?: number;
  finalRedondeada?: number;
  estado?: string;
  faltantes?: string[];
};

type MapeoClassroom = {
  _id: string;
  periodoId: string;
  courseId: string;
  courseWorkId: string;
  tituloEvidencia?: string;
  ponderacion?: number;
  corte?: number;
  activo?: boolean;
};

function numeroSeguro(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

const POLITICAS_FALLBACK: Politica[] = [
  { codigo: 'POLICY_LISC_ENCUADRE_2026', version: 1, nombre: 'LISC Encuadre 2026' },
  { codigo: 'POLICY_SV_EXCEL_2026', version: 1, nombre: 'SV Excel 2026' }
];

export function SeccionEvaluaciones(params: {
  periodos: Periodo[];
  alumnos: Alumno[];
  puedeGestionar: boolean;
  puedeClassroomConectar: boolean;
  puedeClassroomPull: boolean;
}) {
  const { periodos, alumnos, puedeGestionar, puedeClassroomConectar, puedeClassroomPull } = params;
  const puedeClassroom = puedeClassroomConectar || puedeClassroomPull;

  const [tabActiva, setTabActiva] = useState<TabEvaluaciones>('politica');
  const [periodoId, setPeriodoId] = useState<string>('');
  const [alumnoId, setAlumnoId] = useState<string>('');
  const [politicas, setPoliticas] = useState<Politica[]>([]);
  const [politicaCodigo, setPoliticaCodigo] = useState<'POLICY_SV_EXCEL_2026' | 'POLICY_LISC_ENCUADRE_2026'>(
    'POLICY_LISC_ENCUADRE_2026'
  );
  const [politicaVersion, setPoliticaVersion] = useState<number>(1);
  const [resumen, setResumen] = useState<ResumenEvaluacion | null>(null);
  const [mapeos, setMapeos] = useState<MapeoClassroom[]>([]);
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState<string>('');

  const [evidenciaTitulo, setEvidenciaTitulo] = useState('');
  const [evidenciaCalificacion, setEvidenciaCalificacion] = useState('10');
  const [evidenciaPonderacion, setEvidenciaPonderacion] = useState('1');
  const [evidenciaCorte, setEvidenciaCorte] = useState('1');

  const [corteExamen, setCorteExamen] = useState<'parcial1' | 'parcial2' | 'global'>('parcial1');
  const [teorico, setTeorico] = useState('10');
  const [practicasCsv, setPracticasCsv] = useState('10');

  const [courseId, setCourseId] = useState('');
  const [courseWorkId, setCourseWorkId] = useState('');
  const [mapeoTitulo, setMapeoTitulo] = useState('');
  const [mapeoPonderacion, setMapeoPonderacion] = useState('1');
  const [mapeoCorte, setMapeoCorte] = useState('1');

  const alumnosDelPeriodo = useMemo(
    () => alumnos.filter((item) => !periodoId || String(item.periodoId) === String(periodoId)),
    [alumnos, periodoId]
  );

  const cargarContexto = useCallback(async () => {
    if (!periodoId) return;
    const respuesta = await clienteApi.obtener<{
      politicas?: Politica[];
      configuracion?: { politicaCodigo?: 'POLICY_SV_EXCEL_2026' | 'POLICY_LISC_ENCUADRE_2026'; politicaVersion?: number } | null;
    }>(`/evaluaciones/v2/contexto?periodoId=${encodeURIComponent(periodoId)}`);

    setPoliticas(Array.isArray(respuesta.politicas) ? respuesta.politicas : []);
    if (respuesta.configuracion?.politicaCodigo) setPoliticaCodigo(respuesta.configuracion.politicaCodigo);
    if (Number.isFinite(Number(respuesta.configuracion?.politicaVersion))) {
      setPoliticaVersion(Number(respuesta.configuracion?.politicaVersion));
    }
  }, [periodoId]);

  const cargarMapeos = useCallback(async () => {
    if (!periodoId || !puedeClassroomPull) return;
    const respuesta = await clienteApi.obtener<{ mapeos?: MapeoClassroom[] }>(
      `/evaluaciones/v2/classroom/mapeos?periodoId=${encodeURIComponent(periodoId)}`
    );
    setMapeos(Array.isArray(respuesta.mapeos) ? respuesta.mapeos : []);
  }, [periodoId, puedeClassroomPull]);

  useEffect(() => {
    if (!periodoId && periodos.length > 0) {
      setPeriodoId(String(periodos[0]?._id || ''));
    }
  }, [periodos, periodoId]);

  useEffect(() => {
    if (!periodoId) return;
    void cargarContexto();
    void cargarMapeos();
  }, [cargarContexto, cargarMapeos, periodoId]);

  useEffect(() => {
    if (!puedeClassroom) return;
    const listener = (event: MessageEvent) => {
      const data = (event.data || {}) as { source?: unknown; status?: unknown; message?: unknown };
      if (String(data.source || '') !== 'classroom-oauth') return;
      if (String(data.status || '') === 'ok') {
        emitToast({ level: 'ok', title: 'Classroom', message: String(data.message || 'Cuenta conectada') });
        void cargarMapeos();
      } else {
        emitToast({ level: 'error', title: 'Classroom', message: String(data.message || 'No se pudo conectar') });
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [cargarMapeos, puedeClassroom]);

  async function guardarPoliticaV2() {
    if (!periodoId) return;
    setCargando(true);
    setEstado('');
    try {
      await clienteApi.enviar('/evaluaciones/v2/politica', {
        periodoId,
        politicaCodigo,
        politicaVersion
      });
      setEstado('Configuración guardada');
      emitToast({ level: 'ok', title: 'Evaluaciones', message: 'Configuración de política guardada' });
      await cargarContexto();
    } catch (error) {
      setEstado('No se pudo guardar la configuración');
      emitToast({ level: 'error', title: 'Evaluaciones', message: String((error as Error)?.message || error) });
    } finally {
      setCargando(false);
    }
  }

  async function guardarEvidenciaV2() {
    if (!periodoId || !alumnoId) return;
    setCargando(true);
    try {
      await clienteApi.enviar('/evaluaciones/v2/evidencias', {
        periodoId,
        alumnoId,
        titulo: evidenciaTitulo || 'Evidencia',
        calificacionDecimal: numeroSeguro(evidenciaCalificacion),
        ponderacion: numeroSeguro(evidenciaPonderacion),
        corte: numeroSeguro(evidenciaCorte)
      });
      emitToast({ level: 'ok', title: 'Evaluaciones', message: 'Evidencia guardada' });
    } catch (error) {
      emitToast({ level: 'error', title: 'Evaluaciones', message: String((error as Error)?.message || error) });
    } finally {
      setCargando(false);
    }
  }

  async function guardarComponenteExamenV2() {
    if (!periodoId || !alumnoId) return;
    const practicas = practicasCsv
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
    setCargando(true);
    try {
      await clienteApi.enviar('/evaluaciones/v2/examenes/componentes', {
        periodoId,
        alumnoId,
        corte: corteExamen,
        teoricoDecimal: numeroSeguro(teorico),
        practicas
      });
      emitToast({ level: 'ok', title: 'Evaluaciones', message: 'Componente de examen guardado' });
    } catch (error) {
      emitToast({ level: 'error', title: 'Evaluaciones', message: String((error as Error)?.message || error) });
    } finally {
      setCargando(false);
    }
  }

  async function consultarResumenV2() {
    if (!periodoId || !alumnoId) return;
    setCargando(true);
    try {
      const respuesta = await clienteApi.obtener<{ resumen?: ResumenEvaluacion }>(
        `/evaluaciones/v2/alumnos/${encodeURIComponent(alumnoId)}/resumen?periodoId=${encodeURIComponent(periodoId)}`
      );
      setResumen(respuesta.resumen ?? null);
    } catch (error) {
      emitToast({ level: 'error', title: 'Evaluaciones', message: String((error as Error)?.message || error) });
      setResumen(null);
    } finally {
      setCargando(false);
    }
  }

  async function conectarClassroom() {
    if (!puedeClassroomConectar) return;
    try {
      const respuesta = await clienteApi.obtener<{ url: string }>('/evaluaciones/v2/classroom/oauth/iniciar');
      const url = String(respuesta.url || '').trim();
      if (!url) {
        throw new Error('No se recibió URL de autorización');
      }
      window.open(url, 'oauth_classroom', 'width=980,height=760');
    } catch (error) {
      emitToast({ level: 'error', title: 'Classroom', message: String((error as Error)?.message || error) });
    }
  }

  async function guardarMapeo() {
    if (!periodoId || !courseId || !courseWorkId || !puedeClassroomPull) return;
    setCargando(true);
    try {
      await clienteApi.enviar('/evaluaciones/v2/classroom/mapeos', {
        periodoId,
        courseId,
        courseWorkId,
        tituloEvidencia: mapeoTitulo || undefined,
        ponderacion: numeroSeguro(mapeoPonderacion),
        corte: numeroSeguro(mapeoCorte)
      });
      emitToast({ level: 'ok', title: 'Classroom', message: 'Mapeo guardado' });
      await cargarMapeos();
    } catch (error) {
      emitToast({ level: 'error', title: 'Classroom', message: String((error as Error)?.message || error) });
    } finally {
      setCargando(false);
    }
  }

  async function ejecutarPull() {
    if (!periodoId || !puedeClassroomPull) return;
    setCargando(true);
    try {
      const respuesta = await clienteApi.enviar<{
        importadas?: number;
        actualizadas?: number;
        omitidas?: number;
      }>('/evaluaciones/v2/classroom/pull', {
        periodoId
      });
      emitToast({
        level: 'ok',
        title: 'Classroom pull',
        message: `Importadas: ${respuesta.importadas ?? 0}, actualizadas: ${respuesta.actualizadas ?? 0}, omitidas: ${respuesta.omitidas ?? 0}`
      });
    } catch (error) {
      emitToast({ level: 'error', title: 'Classroom pull', message: String((error as Error)?.message || error) });
    } finally {
      setCargando(false);
    }
  }

  const listaPoliticas = politicas.length > 0 ? politicas : POLITICAS_FALLBACK;

  return (
    <div className="panel">
      <h3>Evaluaciones y políticas</h3>
      {estado && <InlineMensaje tipo="info">{estado}</InlineMensaje>}

      <div className="item-row">
        <Boton type="button" onClick={() => setTabActiva('politica')} disabled={tabActiva === 'politica'}>
          Política
        </Boton>
        <Boton type="button" onClick={() => setTabActiva('evidencias')} disabled={tabActiva === 'evidencias'}>
          Evidencias
        </Boton>
        <Boton type="button" onClick={() => setTabActiva('examenes')} disabled={tabActiva === 'examenes'}>
          Exámenes
        </Boton>
        <Boton type="button" onClick={() => setTabActiva('classroom')} disabled={tabActiva === 'classroom'}>
          Classroom
        </Boton>
        <Boton type="button" onClick={() => setTabActiva('resumen')} disabled={tabActiva === 'resumen'}>
          Resumen
        </Boton>
      </div>

      <div className="item-row">
        <label>
          Periodo
          <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
            <option value="">Selecciona periodo</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id}>
                {periodo.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Alumno
          <select value={alumnoId} onChange={(event) => setAlumnoId(event.target.value)}>
            <option value="">Selecciona alumno</option>
            {alumnosDelPeriodo.map((alumno) => (
              <option key={alumno._id} value={alumno._id}>
                {alumno.nombreCompleto}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tabActiva === 'politica' && (
        <div className="item-row">
          <label>
            Política
            <select
              value={politicaCodigo}
              onChange={(event) => setPoliticaCodigo(event.target.value as 'POLICY_SV_EXCEL_2026' | 'POLICY_LISC_ENCUADRE_2026')}
            >
              {listaPoliticas.map((politica) => (
                <option key={`${politica.codigo}-${politica.version}`} value={politica.codigo}>
                  {politica.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Versión
            <input type="number" min={1} value={politicaVersion} onChange={(event) => setPoliticaVersion(Number(event.target.value) || 1)} />
          </label>
          <Boton type="button" disabled={!puedeGestionar || !periodoId || cargando} onClick={() => void guardarPoliticaV2()}>
            Guardar política
          </Boton>
        </div>
      )}

      {tabActiva === 'evidencias' && (
        <div className="item-row">
          <label>
            Evidencia título
            <input value={evidenciaTitulo} onChange={(event) => setEvidenciaTitulo(event.target.value)} />
          </label>
          <label>
            Calificación
            <input value={evidenciaCalificacion} onChange={(event) => setEvidenciaCalificacion(event.target.value)} />
          </label>
          <label>
            Ponderación
            <input value={evidenciaPonderacion} onChange={(event) => setEvidenciaPonderacion(event.target.value)} />
          </label>
          <label>
            Corte
            <select value={evidenciaCorte} onChange={(event) => setEvidenciaCorte(event.target.value)}>
              <option value="1">C1</option>
              <option value="2">C2</option>
              <option value="3">C3</option>
            </select>
          </label>
          <Boton type="button" disabled={!puedeGestionar || !periodoId || !alumnoId || cargando} onClick={() => void guardarEvidenciaV2()}>
            Guardar evidencia
          </Boton>
        </div>
      )}

      {tabActiva === 'examenes' && (
        <div className="item-row">
          <label>
            Corte examen
            <select value={corteExamen} onChange={(event) => setCorteExamen(event.target.value as 'parcial1' | 'parcial2' | 'global')}>
              <option value="parcial1">Parcial 1</option>
              <option value="parcial2">Parcial 2</option>
              <option value="global">Global</option>
            </select>
          </label>
          <label>
            Teórico
            <input value={teorico} onChange={(event) => setTeorico(event.target.value)} />
          </label>
          <label>
            Prácticas (csv)
            <input value={practicasCsv} onChange={(event) => setPracticasCsv(event.target.value)} />
          </label>
          <Boton type="button" disabled={!puedeGestionar || !periodoId || !alumnoId || cargando} onClick={() => void guardarComponenteExamenV2()}>
            Guardar examen
          </Boton>
        </div>
      )}

      {tabActiva === 'classroom' && (
        <div className="panel">
          <h4>Google Classroom (pull)</h4>
          <div className="item-row">
            <Boton type="button" disabled={!puedeClassroomConectar || cargando} onClick={() => void conectarClassroom()}>
              Conectar Google
            </Boton>
            <Boton type="button" disabled={!puedeClassroomPull || !periodoId || cargando} onClick={() => void ejecutarPull()}>
              Ejecutar pull
            </Boton>
          </div>
          <div className="item-row">
            <label>
              Course ID
              <input value={courseId} onChange={(event) => setCourseId(event.target.value)} />
            </label>
            <label>
              CourseWork ID
              <input value={courseWorkId} onChange={(event) => setCourseWorkId(event.target.value)} />
            </label>
            <label>
              Título evidencia
              <input value={mapeoTitulo} onChange={(event) => setMapeoTitulo(event.target.value)} />
            </label>
            <label>
              Ponderación
              <input value={mapeoPonderacion} onChange={(event) => setMapeoPonderacion(event.target.value)} />
            </label>
            <label>
              Corte
              <select value={mapeoCorte} onChange={(event) => setMapeoCorte(event.target.value)}>
                <option value="1">C1</option>
                <option value="2">C2</option>
                <option value="3">C3</option>
              </select>
            </label>
            <Boton
              type="button"
              disabled={!puedeClassroomPull || !periodoId || !courseId || !courseWorkId || cargando}
              onClick={() => void guardarMapeo()}
            >
              Guardar mapeo
            </Boton>
          </div>
          {mapeos.length > 0 && (
            <ul className="lista">
              {mapeos.map((item) => (
                <li key={item._id}>
                  {item.courseId} / {item.courseWorkId} - {item.tituloEvidencia || 'Sin título'} (corte {item.corte || '-'})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tabActiva === 'resumen' && (
        <div className="panel">
          <h4>Resumen alumno</h4>
          <div className="item-row">
            <Boton type="button" disabled={!periodoId || !alumnoId || cargando} onClick={() => void consultarResumenV2()}>
              Consultar resumen
            </Boton>
          </div>
          {!resumen && <InlineMensaje tipo="info">Consulta el resumen para visualizar resultados del alumno.</InlineMensaje>}
          {resumen && (
            <>
              <p>
                Política: {resumen.politicaCodigo} v{resumen.politicaVersion}
              </p>
              <p>
                Continua: C1 {numeroSeguro(resumen.continuaPorCorte?.c1).toFixed(2)} | C2 {numeroSeguro(resumen.continuaPorCorte?.c2).toFixed(2)} |
                C3 {numeroSeguro(resumen.continuaPorCorte?.c3).toFixed(2)}
              </p>
              <p>
                Exámenes: P1 {numeroSeguro(resumen.examenesPorCorte?.parcial1).toFixed(2)} | P2 {numeroSeguro(resumen.examenesPorCorte?.parcial2).toFixed(2)} |
                G {numeroSeguro(resumen.examenesPorCorte?.global).toFixed(2)}
              </p>
              <p>
                Bloque continua: {numeroSeguro(resumen.bloqueContinuaDecimal).toFixed(4)} | Bloque exámenes:{' '}
                {numeroSeguro(resumen.bloqueExamenesDecimal).toFixed(4)}
              </p>
              <p>
                Final decimal: {numeroSeguro(resumen.finalDecimal).toFixed(4)} | Final redondeada:{' '}
                {numeroSeguro(resumen.finalRedondeada).toFixed(0)}
              </p>
              {Array.isArray(resumen.faltantes) && resumen.faltantes.length > 0 && (
                <InlineMensaje tipo="warning">Faltantes: {resumen.faltantes.join(', ')}</InlineMensaje>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}