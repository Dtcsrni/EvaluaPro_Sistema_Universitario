import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { clienteApi } from '../../../clienteApiDocente';
import type { Periodo, Plantilla } from '../../../tipos';
import { mensajeDeError } from '../../../utilidades';

export function usePlantillasArchivadasGeneracion(
  habilitado: boolean,
  periodosArchivados: Periodo[],
  setMensaje: Dispatch<SetStateAction<string>>
): Plantilla[] {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);

  useEffect(() => {
    if (!habilitado) return;
    let vigente = true;
    void clienteApi.obtener<{ plantillas?: Plantilla[] }>('/examenes/plantillas?archivado=true')
      .then(({ plantillas: respuesta = [] }) => {
        const periodosCerrados = new Set(periodosArchivados.map(({ _id }) => _id));
        const archivadas = (Array.isArray(respuesta) ? respuesta : []).filter(
          (plantilla) => Boolean(plantilla.archivadoEn) && periodosCerrados.has(String(plantilla.periodoId ?? ''))
        );
        if (vigente) setPlantillas(archivadas);
      })
      .catch((error) => {
        if (vigente) setMensaje(mensajeDeError(error, 'No se pudieron cargar las plantillas de materias cerradas'));
      });
    return () => { vigente = false; };
  }, [habilitado, periodosArchivados, setMensaje]);

  return plantillas;
}
