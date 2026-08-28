#!/usr/bin/env node
/**
 * ai-openai-client
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * ai-openai-client
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * ai-openai-client
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * ai-openai-client
 *
 * Responsabilidad: ejecutar una solicitud real a OpenAI usando el modelo elegido por el router.
 * Limites: cliente minimo basado en fetch; no introduce dependencia externa.
 */

import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { seleccionarModeloAutomatico } from './ai-model-router.mjs';

export const OPENAI_MODEL_MAP = Object.freeze({
  'gpt-5.4': 'gpt-5.4',
  'gpt-5.4-mini': 'gpt-5-mini',
  'gpt-5.3-codex': 'gpt-5-codex',
  'gpt-5.2-codex': 'gpt-5-codex',
  'gpt-5.2': 'gpt-5.2',
  'gpt-5.1-codex-max': 'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini': 'gpt-5-mini'
});

function normalizarTexto(valor) {
  return String(valor ?? '').trim();
}

export function resolverModeloOpenAI(modeloSeleccionado, mapa = OPENAI_MODEL_MAP) {
  const modelo = normalizarTexto(modeloSeleccionado);
  return mapa[modelo] || modelo;
}

function construirContenidoUsuario(task, prompt) {
  const partes = [];
  const taskNormalizada = normalizarTexto(task);
  const promptNormalizado = normalizarTexto(prompt);

  if (taskNormalizada) partes.push(`Tarea: ${taskNormalizada}`);
  if (promptNormalizado) partes.push(promptNormalizado);

  return partes.join('\n\n');
}

function extraerTextoRespuesta(responseJson) {
  if (typeof responseJson?.output_text === 'string' && responseJson.output_text.trim().length > 0) {
    return responseJson.output_text;
  }

  const partes = [];
  for (const item of Array.isArray(responseJson?.output) ? responseJson.output : []) {
    for (const chunk of Array.isArray(item?.content) ? item.content : []) {
      if (typeof chunk?.text === 'string' && chunk.text.trim().length > 0) {
        partes.push(chunk.text);
      }
    }
  }

  return partes.join('').trim();
}

function esModeloLigero(modeloApi) {
  return modeloApi === 'gpt-5-mini' || modeloApi === 'gpt-5.2' || modeloApi === 'gpt-5.4-mini';
}

async function leerCuerpoError(response) {
  try {
    const texto = await response.text();
    return texto.trim().length > 0 ? texto : '<sin cuerpo>';
  } catch {
    return '<sin cuerpo>';
  }
}

export async function enviarSolicitudAutomaticaOpenAI({
  task,
  prompt,
  systemPrompt = 'Responde con precisión, concision y foco en el objetivo.',
  budget,
  mode,
  preferStrong,
  maxOutputTokens = 1024,
  fetchImpl = fetch,
  apiKey = process.env.OPENAI_API_KEY,
  baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  modelMap = OPENAI_MODEL_MAP
} = {}) {
  if (!apiKey) {
    throw new Error('Falta OPENAI_API_KEY.');
  }

  const decision = seleccionarModeloAutomatico({
    task,
    prompt,
    budget,
    mode,
    preferStrong
  });

  const apiModel = resolverModeloOpenAI(decision.model, modelMap);
  const body = {
    model: apiModel,
    instructions: normalizarTexto(systemPrompt),
    input: construirContenidoUsuario(task, prompt),
    max_output_tokens: Number(maxOutputTokens) > 0 ? Number(maxOutputTokens) : 1024,
    store: false
  };

  if (!esModeloLigero(apiModel)) {
    body.reasoning = { effort: decision.reasoning };
  }

  const response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const responseJson = await response.json().catch(() => null);
  if (!response.ok) {
    const detalle = await leerCuerpoError({ text: async () => JSON.stringify(responseJson ?? {}) });
    throw new Error(`OpenAI responses API fallo (${response.status}): ${detalle}`);
  }

  const text = extraerTextoRespuesta(responseJson);
  return {
    decision,
    apiModel,
    responseId: responseJson?.id || null,
    text,
    response: responseJson
  };
}

function parseArgs(argv) {
  const out = {
    task: '',
    prompt: '',
    systemPrompt: '',
    budget: 'balanced',
    mode: 'auto',
    preferStrong: false,
    maxOutputTokens: 1024,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task') {
      out.task = String(argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--prompt') {
      out.prompt = String(argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--system') {
      out.systemPrompt = String(argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--budget') {
      out.budget = String(argv[i + 1] ?? 'balanced');
      i += 1;
      continue;
    }
    if (arg === '--mode') {
      out.mode = String(argv[i + 1] ?? 'auto');
      i += 1;
      continue;
    }
    if (arg === '--prefer-strong') {
      out.preferStrong = true;
      continue;
    }
    if (arg === '--max-output-tokens') {
      out.maxOutputTokens = Number(argv[i + 1] ?? 1024);
      i += 1;
      continue;
    }
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }

  return out;
}

function imprimirAyuda() {
  console.log(
    [
      'Uso:',
      '  OPENAI_API_KEY=... node scripts/ai-openai-client.mjs --task "bug multiarchivo" --prompt "Describe el cambio"',
      '',
      'Flags:',
      '  --task                Descripcion corta de la tarea',
      '  --prompt              Prompt principal a enviar',
      '  --system              Instrucciones de sistema opcionales',
      '  --budget low|balanced|high',
      '  --mode auto|coding|reasoning|cheap',
      '  --prefer-strong',
      '  --max-output-tokens N',
      '  --json'
    ].join('\n')
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    imprimirAyuda();
    return;
  }

  if (!normalizarTexto(args.task) && !normalizarTexto(args.prompt)) {
    imprimirAyuda();
    process.exitCode = 2;
    return;
  }

  const result = await enviarSolicitudAutomaticaOpenAI({
    task: args.task,
    prompt: args.prompt,
    systemPrompt: args.systemPrompt || undefined,
    budget: args.budget,
    mode: args.mode,
    preferStrong: args.preferStrong,
    maxOutputTokens: args.maxOutputTokens
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`apiModel=${result.apiModel}`);
  console.log(`decision=${result.decision.model}`);
  console.log(`reasoning=${result.decision.reasoning}`);
  if (result.text) {
    console.log('\n' + result.text);
  }
}

const isCli = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isCli) {
  main().catch((error) => {
    console.error('[ai-openai-client] error inesperado:', error);
    process.exit(1);
  });
}

