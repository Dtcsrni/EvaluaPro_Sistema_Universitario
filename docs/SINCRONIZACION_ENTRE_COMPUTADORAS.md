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

## Integridad / anti-corrupción

- El export incluye `checksumSha256` (SHA-256 del JSON descomprimido).
- En importación, el backend valida ese checksum antes de aplicar cambios.
  - Si el checksum no coincide, el import se **bloquea** para evitar corrupción silenciosa.
- Los PDFs (si se incluyen) también llevan checksum y se descartan si no coincide.

## Uso desde la UI (Docente)

1. En la computadora origen, entra a la vista **Publicar**.
2. En el panel **Sincronizar entre computadoras**:
   - (Opcional) elige una Materia
   - (Opcional) define "Desde" para export incremental
   - (Opcional) marca "Incluir PDFs"
  - Presiona **Exportar paquete** y guarda el archivo `.ep-sync.json` (compatible con `.seu-sync.json`)
3. Copia el archivo a la otra computadora (USB/Drive).
4. En la computadora destino, entra a la misma vista y usa **Importar paquete**.

Durante la importación:
- Primero se hace una validación ("dry-run") del paquete.
- El sistema te pide confirmación antes de aplicar cambios.

Notas:
- El paquete solo se puede importar en la misma cuenta/docente (mismo `docenteId`).
- Si incluyes PDFs, el backend limita el tamaño para evitar paquetes gigantes.

## Endpoints (API)

- `POST /sincronizaciones/paquete/exportar`
  - body: `{ periodoId?: string, desde?: ISODateString, incluirPdfs?: boolean }`
  - response: `{ paqueteBase64, checksumSha256, checksumGzipSha256, exportadoEn, conteos }`

- `POST /sincronizaciones/paquete/importar`
  - body: `{ paqueteBase64: string, checksumSha256?: string, dryRun?: boolean }`
  - response (dry-run): `{ mensaje, checksumSha256, conteos }`
  - response (import): `{ mensaje, resultados, pdfsGuardados }`
