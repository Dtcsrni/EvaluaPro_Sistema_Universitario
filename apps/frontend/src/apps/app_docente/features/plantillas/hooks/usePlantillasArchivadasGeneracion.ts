import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { clienteApi } from '../../../clienteApiDocente';
import type { Periodo, Plantilla } from '../../../tipos';
import { mensajeDeError } from '../../../utilidades';

export function filtrarPlantillasArchivadasDePeriodosCerrados(
  plantillas: Plantilla[],
  periodosArchivados: Periodo[],
  ahora = Date.now()
) {
  const periodosCerrados = new Set(periodosArchivados
    .filter((periodo) => Number.isFinite(Date.parse(String(periodo.fechaFin ?? ''))) && Date.parse(String(periodo.fechaFin)) < ahora)
    .map((periodo) => periodo._id));
  return plantillas.filter((plantilla) => Boolean(plantilla.archivadoEn) && periodosCerrados.has(String(plantilla.periodoId ?? '')));
}

export function usePlantillasArchivadasGeneracion({
  habilitada,
  puedeLeer,
  periodosArchivados,
  setMensaje
}: {
  habilitada: boolean;
  puedeLeer: boolean;
  periodosArchivados: Periodo[];
  setMensaje: Dispatch<SetStateAction<string>>;
}) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);

  useEffect(() => {
    if (!habilitada || !puedeLeer) return;
    let vigente = true;
    void clienteApi.obtener<{ plantillas?: Plantilla[] }>('/examenes/plantillas?archivado=true')
      .then((respuesta) => {
        const archivadas = filtrarPlantillasArchivadasDePeriodosCerrados(
          Array.isArray(respuesta.plantillas) ? respuesta.plantillas : [],
          periodosArchivados
        );
        if (vigente) setPlantillas(archivadas);
      })
      .catch((error) => {
        if (vigente) setMensaje(mensajeDeError(error, 'No se pudieron cargar las plantillas de materias cerradas'));
      });
    return () => { vigente = false; };
  }, [habilitada, puedeLeer, periodosArchivados, setMensaje]);

  return plantillas;
}
