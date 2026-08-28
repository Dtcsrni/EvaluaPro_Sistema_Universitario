/**
 * Hook para encapsular la carga, actualización y estado de recursos académicos base del docente:
 * Alumnos, Periodos/Materias (activas y archivadas), Plantillas y Banco de Preguntas.
 */
import { useCallback, useEffect, useState } from 'react';
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

export function useRecursosAcademicosDocente({ docente, permisosUI, montadoRef }: ParametrosHook) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodosArchivados, setPeriodosArchivados] = useState<Periodo[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [ultimaActualizacionDatos, setUltimaActualizacionDatos] = useState<number | null>(null);

  const refrescarMaterias = useCallback(() => {
    if (!permisosUI.periodos.leer) {
      setPeriodos([]);
      setPeriodosArchivados([]);
      return Promise.resolve();
    }
    return Promise.all([
      clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=1'),
      clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=0')
    ]).then(([peActivas, peArchivadas]) => {
      if (!montadoRef.current) return;
      const activas = peActivas.periodos ?? peActivas.materias ?? [];
      const archivadas = peArchivadas.periodos ?? peArchivadas.materias ?? [];
      const activasArray = Array.isArray(activas) ? activas : [];
      const archivadasArray = Array.isArray(archivadas) ? archivadas : [];
      const ids = (lista: Periodo[]) => lista.map((m) => m._id).filter(Boolean).sort().join('|');
      const mismoContenido = activasArray.length > 0 && ids(activasArray) === ids(archivadasArray);
      if (mismoContenido) {
        setPeriodos(activasArray.filter((m) => m.activo !== false));
        setPeriodosArchivados(activasArray.filter((m) => m.activo === false));
      } else {
        setPeriodos(activasArray);
        setPeriodosArchivados(archivadasArray);
      }
      setUltimaActualizacionDatos(Date.now());
    });
  }, [montadoRef, permisosUI.periodos.leer]);

  const refrescarDatos = useCallback(async () => {
    if (!docente) return;
    if (montadoRef.current) setCargandoDatos(true);
    try {
      const tareas: Array<Promise<void>> = [];
      if (permisosUI.alumnos.leer) {
        tareas.push(
          clienteApi.obtener<{ alumnos: Alumno[] }>('/alumnos').then((al) => {
            if (montadoRef.current) setAlumnos(al.alumnos);
          })
        );
      } else {
        setAlumnos([]);
      }
      if (permisosUI.periodos.leer) {
        tareas.push(refrescarMaterias());
      } else {
        setPeriodos([]);
        setPeriodosArchivados([]);
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
        tareas.push(
          clienteApi.obtener<{ preguntas: Pregunta[] }>('/banco-preguntas').then((pr) => {
            if (montadoRef.current) setPreguntas(pr.preguntas);
          })
        );
      } else {
        setPreguntas([]);
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
    refrescarMaterias
  ]);

  useEffect(() => {
    void refrescarDatos();
  }, [refrescarDatos]);

  return {
    alumnos,
    setAlumnos,
    periodos,
    setPeriodos,
    periodosArchivados,
    setPeriodosArchivados,
    plantillas,
    setPlantillas,
    preguntas,
    setPreguntas,
    cargandoDatos,
    ultimaActualizacionDatos,
    refrescarMaterias,
    refrescarDatos
  };
}
