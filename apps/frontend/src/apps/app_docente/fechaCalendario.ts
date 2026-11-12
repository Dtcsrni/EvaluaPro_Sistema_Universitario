function fechaDesdePartes(año: number, mes: number, dia: number): Date | null {
  const diasPorMes = [31, año % 4 === 0 && (año % 100 !== 0 || año % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (año < 1 || mes < 1 || mes > 12 || dia < 1 || dia > diasPorMes[mes - 1]) return null;

  const fecha = new Date(0);
  fecha.setUTCHours(0, 0, 0, 0);
  fecha.setUTCFullYear(año, mes - 1, dia);
  return fecha;
}

export function normalizarFechaCalendarioISO(valor?: string | null): string | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(texto);
  if (iso) {
    const [, año, mes, dia] = iso;
    const fecha = fechaDesdePartes(Number(año), Number(mes), Number(dia));
    return fecha ? `${año}-${mes}-${dia}` : null;
  }

  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return null;
  return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, '0'), String(fecha.getDate()).padStart(2, '0')].join('-');
}

export function fechaCalendarioEnMilisegundos(valor?: string | null): number | null {
  const iso = normalizarFechaCalendarioISO(valor);
  if (!iso) return null;
  const [año, mes, dia] = iso.split('-').map(Number);
  return fechaDesdePartes(año, mes, dia)?.getTime() ?? null;
}

export function formatearFechaCalendario(valor?: string | null, locale?: string): string | null {
  const milisegundos = fechaCalendarioEnMilisegundos(valor);
  if (milisegundos === null) return null;
  return new Intl.DateTimeFormat(locale ?? 'es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(new Date(milisegundos));
}
