/**
 * seedAdmin
 *
 * Responsabilidad: Crear el docente administrador por defecto si no existe en SQLite.
 */
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { crearHash } from './servicioHash';

function shouldSeed(): boolean {
  const env = String(process.env.NODE_ENV || '').toLowerCase();
  if (env !== 'production') return true;
  return String(process.env.SEED_ADMIN_FORCE || '').toLowerCase() === 'true';
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value: unknown): string {
  return String(value || '').trim();
}

export async function seedAdminDocente() {
  if (!shouldSeed()) return;

  const correo = normalizeEmail(process.env.SEED_ADMIN_EMAIL);
  const contrasena = String(process.env.SEED_ADMIN_PASSWORD || '');
  const nombreCompleto = normalizeName(process.env.SEED_ADMIN_NOMBRE_COMPLETO || 'Administrador');

  if (!correo || !contrasena) return;

  const existente = await prisma.docente.findUnique({ where: { correo } });
  const nombresPartes = nombreCompleto.split(' ').map((p) => p.trim()).filter(Boolean);
  const nombres = nombresPartes.length ? nombresPartes.slice(0, -1).join(' ') || nombresPartes[0] : undefined;
  const apellidos = nombresPartes.length >= 2 ? nombresPartes.slice(-1).join(' ') : undefined;

  if (existente) {
    const rolesActuales = Array.isArray(JSON.parse(existente.roles || '[]'))
      ? JSON.parse(existente.roles || '[]')
      : [];

    const debeAgregarAdmin = !rolesActuales.includes('admin');
    const debeAgregarDocente = !rolesActuales.includes('docente');

    const updateData: Record<string, any> = {};
    const roles = [...rolesActuales];
    if (debeAgregarAdmin) roles.push('admin');
    if (debeAgregarDocente) roles.push('docente');
    if (debeAgregarAdmin || debeAgregarDocente) updateData.roles = JSON.stringify(roles);

    if (!existente.hashContrasena) updateData.hashContrasena = await crearHash(contrasena);
    if (!existente.activo) updateData.activo = true;

    if (Object.keys(updateData).length) {
      await prisma.docente.update({
        where: { id: existente.id },
        data: updateData
      });
    }
    return;
  }

  const hashContrasena = await crearHash(contrasena);
  await prisma.docente.create({
    data: {
      nombres: nombres || null,
      apellidos: apellidos || null,
      nombreCompleto,
      correo,
      hashContrasena,
      activo: true,
      roles: JSON.stringify(['admin', 'docente']),
      ultimoAcceso: new Date()
    }
  });
}
