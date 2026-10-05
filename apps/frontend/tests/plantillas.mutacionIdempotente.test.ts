import { describe, expect, it } from 'vitest';
import { confirmarClientRequestIdPlantilla, obtenerClientRequestIdPlantilla } from '../src/apps/app_docente/features/plantillas/mutacionIdempotente';

function crearAlmacenamiento() {
  const valores = new Map<string, string>();
  return {
    getItem: (clave: string) => valores.get(clave) ?? null,
    setItem: (clave: string, valor: string) => valores.set(clave, valor),
    removeItem: (clave: string) => valores.delete(clave)
  } as unknown as Storage;
}

describe('ID estable para mutaciones de plantilla en GUI', () => {
  it('reutiliza el mismo UUID para el mismo payload tras respuesta incierta', () => {
    const storage = crearAlmacenamiento();
    const payload = { titulo: 'Parcial 1', preguntasIds: ['pregunta-1'] };
    const inicial = obtenerClientRequestIdPlantilla('crear', null, payload, storage);
    const reintento = obtenerClientRequestIdPlantilla('crear', null, { preguntasIds: ['pregunta-1'], titulo: 'Parcial 1' }, storage);

    expect(inicial).toMatch(/^[0-9a-f-]{36}$/i);
    expect(reintento).toBe(inicial);
  });

  it('separa payloads distintos y elimina la clave solo al confirmar éxito', () => {
    const storage = crearAlmacenamiento();
    const inicial = obtenerClientRequestIdPlantilla('actualizar', 'plantilla-1', { titulo: 'P1' }, storage);
    const cambio = obtenerClientRequestIdPlantilla('actualizar', 'plantilla-1', { titulo: 'P2' }, storage);
    expect(cambio).not.toBe(inicial);

    confirmarClientRequestIdPlantilla('actualizar', 'plantilla-1', inicial, storage);
    expect(obtenerClientRequestIdPlantilla('actualizar', 'plantilla-1', { titulo: 'P2' }, storage)).toBe(cambio);
    confirmarClientRequestIdPlantilla('actualizar', 'plantilla-1', cambio, storage);
    expect(obtenerClientRequestIdPlantilla('actualizar', 'plantilla-1', { titulo: 'P2' }, storage)).not.toBe(cambio);
  });

  it('usa localStorage por defecto para recuperar el UUID tras una respuesta incierta', () => {
    const primero = obtenerClientRequestIdPlantilla('crear', null, { titulo: 'Global' });
    const reintento = obtenerClientRequestIdPlantilla('crear', null, { titulo: 'Global' });

    expect(reintento).toBe(primero);
    confirmarClientRequestIdPlantilla('crear', null, primero);
  });

  it('falla de forma explícita si no puede persistir el ID de reintento', () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new Error('quota'); },
      removeItem: () => {}
    } as unknown as Storage;

    expect(() => obtenerClientRequestIdPlantilla('crear', null, { titulo: 'Global' }, storage))
      .toThrow('No se pudo guardar el ID de reintento de la plantilla. Libera espacio de almacenamiento y vuelve a intentar.');
  });
});
