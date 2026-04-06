import mongoose from 'mongoose';
import { conectarBaseDatos } from '../src/infraestructura/baseDatos/mongoose';
import { verificarArtifactsRecuperacion } from '../src/modulos/modulo_recuperacion_examenes/servicioRecuperacionExamenes';

type Args = {
  actorDocenteId: string;
  actorRoles: string[];
  manifestHash?: string;
  bundleHash?: string;
  loteId?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    actorDocenteId: '',
    actorRoles: ['admin']
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--actor-docente-id' || key === '--docente-id') && value) {
      args.actorDocenteId = value;
      i += 1;
      continue;
    }
    if ((key === '--roles' || key === '--actor-roles') && value) {
      args.actorRoles = value.split(',').map((role) => role.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (key === '--manifest-hash' && value) {
      args.manifestHash = value;
      i += 1;
      continue;
    }
    if (key === '--bundle-hash' && value) {
      args.bundleHash = value;
      i += 1;
      continue;
    }
    if (key === '--lote-id' && value) {
      args.loteId = value;
      i += 1;
    }
  }
  if (!args.actorDocenteId) throw new Error('Falta --actor-docente-id');
  if (!args.manifestHash && !args.bundleHash && !args.loteId) {
    throw new Error('Debes indicar --manifest-hash o --bundle-hash o --lote-id');
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  await conectarBaseDatos();
  try {
    const result = await verificarArtifactsRecuperacion({
      actorDocenteId: args.actorDocenteId,
      actorRoles: args.actorRoles,
      manifestHash: args.manifestHash,
      bundleHash: args.bundleHash,
      loteId: args.loteId
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
