import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePermisosDocente } from '../src/apps/app_docente/hooks/usePermisosDocente';
import type { Docente } from '../src/apps/app_docente/tipos';

function docenteConPermisos(permisos: string[]): Docente {
  return { id: 'docente-rbac-test', nombreCompleto: 'Docente RBAC', correo: 'rbac@local.test', permisos };
}

describe('permisos granulares del banco', () => {
  it('mantiene permisos granulares para perfiles antiguos con banco:gestionar', () => {
    const { result } = renderHook(() => usePermisosDocente(docenteConPermisos(['banco:gestionar'])));
    expect(result.current.puede('banco:ingestar')).toBe(true);
    expect(result.current.puede('banco:revisar')).toBe(true);
    expect(result.current.puede('banco:publicar')).toBe(true);
  });

  it('no amplía el permiso de ingesta hacia revisión o publicación', () => {
    const { result } = renderHook(() => usePermisosDocente(docenteConPermisos(['banco:ingestar'])));
    expect(result.current.puede('banco:ingestar')).toBe(true);
    expect(result.current.puede('banco:revisar')).toBe(false);
    expect(result.current.puede('banco:publicar')).toBe(false);
  });
});
