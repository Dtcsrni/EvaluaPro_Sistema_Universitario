import { beforeEach, describe, expect, it } from 'vitest';
import {
  eliminarFotoPerfilLocal,
  guardarFotoPerfilLocal,
  MAX_FOTO_PERFIL_BYTES,
  obtenerFotoPerfilLocal
} from '../src/apps/app_docente/fotoPerfilDocente';

describe('fotoPerfilDocente', () => {
  beforeEach(() => localStorage.clear());

  it('guarda, separa por docente y retira la imagen local', () => {
    const foto = 'data:image/png;base64,aGVsbG8=';
    guardarFotoPerfilLocal('docente/1', foto);

    expect(obtenerFotoPerfilLocal('docente/1')).toBe(foto);
    expect(obtenerFotoPerfilLocal('docente/2')).toBeNull();
    eliminarFotoPerfilLocal('docente/1');
    expect(obtenerFotoPerfilLocal('docente/1')).toBeNull();
  });

  it('rechaza formatos distintos de PNG, JPEG y WebP', () => {
    expect(() => guardarFotoPerfilLocal('doc-1', 'data:image/svg+xml;base64,PHN2Zz4=')).toThrow('PNG, JPG o WebP');
  });

  it('rechaza imágenes que exceden 1 MB', () => {
    const demasiadoGrande = `data:image/png;base64,${'a'.repeat(MAX_FOTO_PERFIL_BYTES * 2)}`;
    expect(() => guardarFotoPerfilLocal('doc-1', demasiadoGrande)).toThrow('superar 1 MB');
  });
});
