# Sincronización entre computadoras (paquete)

Esta opción permite mover datos del sistema entre instalaciones (por ejemplo, de una PC a otra) mediante un archivo.

## Qué sincroniza

El paquete incluye (según disponibilidad):

- Materias (periodos)
- Alumnos
- Banco de preguntas
- Plantillas de examen
- Exámenes generados
- Entregas / banderas / calificaciones asociadas
- PDFs (opcional, **best-effort** y puede hacer el paquete pesado)

## Reglas de conflicto (importación)

- Si un registro ya existe en la computadora destino, se conserva el que tenga `updatedAt` más reciente.
- El paquete es **idempotente**: se puede importar varias veces.

## Uso desde la UI (Docente)

1. En la computadora origen, entra a la vista **Publicar**.
2. En el panel **Sincronizar entre computadoras**:
   - (Opcional) elige una Materia
   - (Opcional) define "Desde" para export incremental
   - (Opcional) marca "Incluir PDFs"
   - Presiona **Exportar paquete** y guarda el archivo `.seu-sync.json`
3. Copia el archivo a la otra computadora (USB/Drive).
4. En la computadora destino, entra a la misma vista y usa **Importar paquete**.

Notas:
- El paquete solo se puede importar en la misma cuenta/docente (mismo `docenteId`).
- Si incluyes PDFs, el backend limita el tamaño para evitar paquetes gigantes.

## Endpoints (API)

- `POST /sincronizaciones/paquete/exportar`
  - body: `{ periodoId?: string, desde?: ISODateString, incluirPdfs?: boolean }`
  - response: `{ paqueteBase64, checksumSha256, exportadoEn, conteos }`

- `POST /sincronizaciones/paquete/importar`
  - body: `{ paqueteBase64: string }`
  - response: `{ mensaje, resultados, pdfsGuardados }`
