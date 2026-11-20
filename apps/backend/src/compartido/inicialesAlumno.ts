const PARTICULAS_NOMBRE = new Set(['a', 'da', 'de', 'del', 'do', 'dos', 'la', 'las', 'los', 'y']);

/** Regla única de iniciales para la cabecera del examen y la vista de alumnos. */
export function construirInicialesAlumno(nombreCompleto: unknown, preservarInicialesAisladas = false): string {
  const palabras = String(nombreCompleto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
  const significativas = palabras.filter((palabra) =>
    (preservarInicialesAisladas && palabra.length === 1) || !PARTICULAS_NOMBRE.has(palabra)
  );
  const iniciales = (significativas.length > 0 ? significativas : palabras)
    .map((palabra) => palabra.charAt(0))
    .join('')
    .toUpperCase();
  return iniciales.length <= 6 ? iniciales : `${iniciales.slice(0, 3)}${iniciales.slice(-3)}`;
}

/** Mantiene la interpretación de nombres estructurados e importados por Classroom. */
export function construirInicialesIdentidadAlumno(params: {
  nombreCompleto?: unknown;
  nombres?: unknown;
  apellidos?: unknown;
}): string {
  const tokensCompletos = String(params.nombreCompleto ?? '').trim().split(/\s+/).filter(Boolean);
  const nombres = String(params.nombres ?? '').trim().split(/\s+/).filter(Boolean);
  const apellidos = String(params.apellidos ?? '').trim().split(/\s+/).filter(Boolean);
  const tieneNombresEstructurados = nombres.length > 0 && apellidos.length > 0;
  const tokensNombre = tieneNombresEstructurados
    ? nombres
    : tokensCompletos.length >= 3
      ? tokensCompletos.slice(2)
      : tokensCompletos.slice(0, 1);
  const tokensRestantes = tieneNombresEstructurados
    ? [...nombres.slice(1), ...apellidos]
    : tokensCompletos.length >= 3
      ? [...tokensCompletos.slice(3), ...tokensCompletos.slice(0, 2)]
      : tokensCompletos.slice(1);
  return `${construirInicialesAlumno(tokensNombre[0]).slice(0, 1)}${construirInicialesAlumno(
    tokensRestantes.join(' '),
    !tieneNombresEstructurados && tokensCompletos.length >= 3
  )}`;
}
