/**
 * Backfill explícito del banco legado al dominio canónico.
 * Requiere que migrate-reactivos-sqlite.mjs ya se haya ejecutado.
 * No elimina ni modifica banco_preguntas.
 */
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? String(process.argv[indice + 1] || '') : '';
}

const database = argumento('--database');
if (database) {
  const databaseUrl = `file:${path.resolve(database).replace(/\\/g, '/')}`;
  // PrismaClient reads DATABASE_URL from the Prisma datasource; the runtime's
  // BACKEND_DATABASE_URL override is not honored by this standalone script.
  process.env.DATABASE_URL = databaseUrl;
  process.env.BACKEND_DATABASE_URL = databaseUrl;
}
const { PrismaClient } = await import('@prisma/client');
const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
const databaseUrl = process.env.BACKEND_DATABASE_URL || process.env.DATABASE_URL || 'file:./data/evaluapro.db';
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });

function claveTema(value) {
  return String(value ?? '').trim().toLowerCase();
}

const resumen = { migrados: 0, existentes: 0, cuarentena: 0, errores: 0, reactivosCuarentena: [] };

try {
  const preguntas = await prisma.bancoPregunta.findMany({
    where: { activo: true },
    include: { versiones: { include: { opciones: true } } },
    orderBy: { id: 'asc' }
  });

  for (const pregunta of preguntas) {
    const externalKey = `legacy:${pregunta.id}`;
    const existente = await prisma.reactivo.findFirst({ where: { docenteId: pregunta.docenteId, externalKey } });
    if (existente) {
      resumen.existentes += 1;
      continue;
    }

    const tema = pregunta.tema
      ? await prisma.temaBanco.findFirst({ where: { docenteId: pregunta.docenteId, periodoId: pregunta.periodoId, clave: claveTema(pregunta.tema), activo: true } })
      : null;
    if (!tema) {
      resumen.cuarentena += 1;
      resumen.reactivosCuarentena.push({ id: pregunta.id, periodoId: pregunta.periodoId, tema: pregunta.tema ?? null });
      continue;
    }
    const omrValido = pregunta.versiones.length > 0 && pregunta.versiones.every((version) => version.opciones.length === 5 && version.opciones.filter((opcion) => opcion.esCorrecta).length === 1);
    if (!omrValido) {
      resumen.cuarentena += 1;
      resumen.reactivosCuarentena.push({ id: pregunta.id, motivo: 'versiones_no_omr_mcq5' });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const reactivo = await tx.reactivo.create({
          data: {
            id: randomUUID(),
            docenteId: pregunta.docenteId,
            externalKey,
            estado: 'published',
            versionActual: pregunta.versionActual,
            legacyPreguntaId: pregunta.id
          }
        });
        for (const version of pregunta.versiones) {
          const contenido = JSON.stringify({ enunciado: version.enunciado, opciones: version.opciones.map((opcion) => ({ texto: opcion.texto, esCorrecta: opcion.esCorrecta })) });
          const canonicalHash = createHash('sha256').update(contenido).digest('hex');
          const versionCanonica = await tx.reactivoVersion.create({
            data: {
              reactivoId: reactivo.id,
              numeroVersion: version.numeroVersion,
              formato: 'omr.mcq5',
              enunciado: version.enunciado,
              metadataJson: JSON.stringify({ legacy: true }),
              procedenciaJson: JSON.stringify({ origin: 'imported', confidence: 1, notes: 'Backfill verificable desde banco_preguntas' }),
              contentHash: canonicalHash
            }
          });
          await tx.reactivoOpcion.createMany({ data: version.opciones.map((opcion, index) => ({ reactivoVersionId: versionCanonica.id, clave: String.fromCharCode(65 + index), texto: opcion.texto, esCorrecta: opcion.esCorrecta })) });
        }
        await tx.reactivoAsignacion.create({ data: { reactivoId: reactivo.id, periodoId: pregunta.periodoId, temaId: tema.id } });
      });
      resumen.migrados += 1;
    } catch (error) {
      resumen.errores += 1;
      resumen.reactivosCuarentena.push({ id: pregunta.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(JSON.stringify(resumen, null, 2));
} finally {
  await prisma.$disconnect();
}
