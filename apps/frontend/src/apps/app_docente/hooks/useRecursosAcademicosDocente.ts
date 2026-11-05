/**
 * Hook para encapsular la carga, actualización y estado de recursos académicos base del docente:
 * Alumnos, Periodos/Materias (activas y archivadas), Plantillas y Banco de Preguntas.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clienteApi } from '../clienteApiDocente';
import type { Alumno, Docente, Periodo, Plantilla, Pregunta } from '../tipos';

type ParametrosHook = {
  docente: Docente | null;
  permisosUI: {
    alumnos: { leer: boolean };
    periodos: { leer: boolean };
    plantillas: { leer: boolean };
    banco: { leer: boolean };
  };
  montadoRef: React.MutableRefObject<boolean>;
};

type RespuestaMaterias = { periodos?: Periodo[]; materias?: Periodo[] };

function extraerMaterias(respuesta: RespuestaMaterias): Periodo[] {
  const materias = respuesta.periodos ?? respuesta.materias ?? [];
  return Array.isArray(materias) ? materias : [];
}

function normalizarResultadosMaterias(
  activasResult: PromiseSettledResult<RespuestaMaterias>,
  archivadasResult: PromiseSettledResult<RespuestaMaterias>
): { activas: Periodo[] | null; archivadas: Periodo[] | null; completas: boolean } {
  const activas = activasResult.status === 'fulfilled' ? extraerMaterias(activasResult.value) : null;
  const archivadas = archivadasResult.status === 'fulfilled' ? extraerMaterias(archivadasResult.value) : null;
  if (!activas || !archivadas) return { activas, archivadas, completas: false };

  const ids = (lista: Periodo[]) => lista.map((materia) => materia._id).filter(Boolean).sort().join('|');
  const mismaRespuesta = activas.length > 0 && ids(activas) === ids(archivadas);
  return mismaRespuesta
    ? {
        activas: activas.filter((materia) => materia.activo !== false),
        archivadas: activas.filter((materia) => materia.activo === false),
        completas: true
      }
    : { activas, archivadas, completas: true };
}

export function useRecursosAcademicosDocente({ docente, permisosUI, montadoRef }: ParametrosHook) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false);
  const [errorCargaAlumnos, setErrorCargaAlumnos] = useState(false);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodosArchivados, setPeriodosArchivados] = useState<Periodo[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [cargandoBanco, setCargandoBanco] = useState(false);
  const [errorCargaBanco, setErrorCargaBanco] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [ultimaActualizacionDatos, setUltimaActualizacionDatos] = useState<number | null>(null);
  const [cargandoMaterias, setCargandoMaterias] = useState(permisosUI.periodos.leer);
  const [errorMaterias, setErrorMaterias] = useState(false);
  const [errorMateriasArchivadas, setErrorMateriasArchivadas] = useState(false);
  const secuenciaCargaAlumnos = useRef(0);
  const secuenciaCargaBanco = useRef(0);

  const refrescarAlumnos = useCallback(async () => {
    const secuenciaActual = ++secuenciaCargaAlumnos.current;
    if (!permisosUI.alumnos.leer) {
      setAlumnos([]);
      setCargandoAlumnos(false);
      setErrorCargaAlumnos(false);
      return;
    }

    setCargandoAlumnos(true);
    setErrorCargaAlumnos(false);
    try {
      const respuesta = await clienteApi.obtener<{ alumnos?: Alumno[] }>('/alumnos');
      if (!montadoRef.current || secuenciaActual !== secuenciaCargaAlumnos.current) return;
      if (!Array.isArray(respuesta?.alumnos)) throw new Error('La respuesta no contiene una lista de alumnos.');
      setAlumnos(respuesta.alumnos);
    } catch {
      if (montadoRef.current && secuenciaActual === secuenciaCargaAlumnos.current) setErrorCargaAlumnos(true);
    } finally {
      if (montadoRef.current && secuenciaActual === secuenciaCargaAlumnos.current) setCargandoAlumnos(false);
    }
  }, [montadoRef, permisosUI.alumnos.leer]);

  const refrescarPreguntas = useCallback(async () => {
    const secuenciaActual = ++secuenciaCargaBanco.current;
    if (!permisosUI.banco.leer) {
      setPreguntas([]);
      setCargandoBanco(false);
      setErrorCargaBanco(false);
      return;
    }

    setCargandoBanco(true);
    setErrorCargaBanco(false);
    try {
      const respuesta = await clienteApi.obtener<{ preguntas?: Pregunta[] }>('/banco-preguntas');
      if (!montadoRef.current || secuenciaActual !== secuenciaCargaBanco.current) return;
      if (!Array.isArray(respuesta?.preguntas)) throw new Error('La respuesta no contiene una lista de preguntas.');
      setPreguntas(respuesta.preguntas);
    } catch (error) {
      if (montadoRef.current && secuenciaActual === secuenciaCargaBanco.current) setErrorCargaBanco(true);
      throw error;
    } finally {
      if (montadoRef.current && secuenciaActual === secuenciaCargaBanco.current) setCargandoBanco(false);
    }
  }, [montadoRef, permisosUI.banco.leer]);

  const refrescarMaterias = useCallback(async () => {
    if (!permisosUI.periodos.leer) {
      setPeriodos([]);
      setPeriodosArchivados([]);
      setCargandoMaterias(false);
      setErrorMaterias(false);
      setErrorMateriasArchivadas(false);
      return;
    }
    setCargandoMaterias(true);
    setErrorMaterias(false);
    setErrorMateriasArchivadas(false);
    const [activasResult, archivadasResult] = await Promise.allSettled([
      clienteApi.obtener<RespuestaMaterias>('/periodos?activo=1'),
      clienteApi.obtener<RespuestaMaterias>('/periodos?activo=0')
    ]);
    if (!montadoRef.current) return;
    const resultados = normalizarResultadosMaterias(activasResult, archivadasResult);
    setErrorMaterias(resultados.activas === null);
    setErrorMateriasArchivadas(resultados.archivadas === null);
    setCargandoMaterias(false);
    if (resultados.activas) setPeriodos(resultados.activas);
    if (resultados.archivadas) setPeriodosArchivados(resultados.archivadas);
    if (resultados.completas) setUltimaActualizacionDatos(Date.now());
  }, [montadoRef, permisosUI.periodos.leer]);

  const refrescarDatos = useCallback(async () => {
    if (!docente) return;
    if (montadoRef.current) setCargandoDatos(true);
    try {
      const tareas: Array<Promise<void>> = [];
      if (permisosUI.alumnos.leer) {
        tareas.push(refrescarAlumnos());
      } else {
        setAlumnos([]);
        setCargandoAlumnos(false);
        setErrorCargaAlumnos(false);
      }
      if (permisosUI.periodos.leer) {
        tareas.push(refrescarMaterias());
      } else {
        setPeriodos([]);
        setPeriodosArchivados([]);
        setCargandoMaterias(false);
        setErrorMaterias(false);
        setErrorMateriasArchivadas(false);
      }
      if (permisosUI.plantillas.leer) {
        tareas.push(
          clienteApi.obtener<{ plantillas: Plantilla[] }>('/examenes/plantillas').then((pl) => {
            if (montadoRef.current) setPlantillas(pl.plantillas);
          })
        );
      } else {
        setPlantillas([]);
      }
      if (permisosUI.banco.leer) {
        tareas.push(refrescarPreguntas().catch(() => undefined));
      } else {
        setPreguntas([]);
        setCargandoBanco(false);
        setErrorCargaBanco(false);
      }
      await Promise.all(tareas);
      setUltimaActualizacionDatos(Date.now());
    } finally {
      if (montadoRef.current) setCargandoDatos(false);
    }
  }, [
    docente,
    montadoRef,
    permisosUI.alumnos.leer,
    permisosUI.banco.leer,
    permisosUI.periodos.leer,
    permisosUI.plantillas.leer,
    refrescarAlumnos,
    refrescarMaterias,
    refrescarPreguntas
  ]);

  useEffect(() => {
    void refrescarDatos();
  }, [refrescarDatos]);

  return {
    alumnos,
    setAlumnos,
    cargandoAlumnos,
    errorCargaAlumnos,
    periodos,
    setPeriodos,
    periodosArchivados,
    setPeriodosArchivados,
    plantillas,
    setPlantillas,
    preguntas,
    setPreguntas,
    cargandoBanco,
    errorCargaBanco,
    refrescarPreguntas,
    cargandoDatos,
    cargandoMaterias,
    errorMaterias,
    errorMateriasArchivadas,
    ultimaActualizacionDatos,
    refrescarMaterias,
    refrescarAlumnos,
    refrescarDatos
  };
}
