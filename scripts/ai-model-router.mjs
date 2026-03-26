#!/usr/bin/env node
/**
 * ai-model-router
 *
 * Responsabilidad: seleccionar automaticamente el modelo mas adecuado segun la tarea.
 * Limites: heuristica ligera; no llama a ningun proveedor ni persiste estado.
 */

import { pathToFileURL } from 'node:url';
import process from 'node:process';

export const MODEL_CATALOG = Object.freeze({
  strongGeneral: 'gpt-5.4',
  balancedGeneral: 'gpt-5.4-mini',
  strongCoding: 'gpt-5.3-codex',
  codingCompat: 'gpt-5.2-codex',
  generalCompat: 'gpt-5.2',
  expertCoding: 'gpt-5.1-codex-max',
  cheapCoding: 'gpt-5.1-codex-mini'
});

const CODING_PATTERNS = [
  'bug',
  'error',
  'fix',
  'refactor',
  'test',
  'lint',
  'typecheck',
  'compile',
  'build',
  'debug',
  'trace',
  'patch',
  'rename',
  'archivo',
  'archivo(s)',
  'codigo',
  'código',
  'repo',
  'repository',
  'typescript',
  'react',
  'express',
  'mongoose',
  'api',
  'controller',
  'service',
  'script'
];

const REASONING_PATTERNS = [
  'arquitectura',
  'architecture',
  'analisis',
  'análisis',
  'decidir',
  'decision',
  'tradeoff',
  'estrategia',
  'plan',
  'roadmap',
  'ambig',
  'investig',
  'producto',
  'scope',
  'policy',
  'contrato'
];

const POLICY_PATTERNS = [
  'politica',
  'policy',
  'estrategia',
  'strategy',
  'economia de tokens',
  'economy of tokens',
  'codex',
  'vscode',
  'visual studio code',
  'compactacion de contexto',
  'compactacion del contexto',
  'compactar contexto',
  'nuevo chat',
  'chat nuevo',
  'abrir chat',
  'abrir un chat nuevo'
];

const LIGHT_PATTERNS = [
  'resumen',
  'summary',
  'docs',
  'documentation',
  'readme',
  'redacta',
  'formatea',
  'extrae',
  'lista',
  'convert',
  'generate'
];

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function countPatternHits(text, patterns) {
  return patterns.reduce((count, pattern) => count + (text.includes(pattern) ? 1 : 0), 0);
}

function inferSignals(text) {
  const codingHits = countPatternHits(text, CODING_PATTERNS);
  const reasoningHits = countPatternHits(text, REASONING_PATTERNS);
  const policyHits = countPatternHits(text, POLICY_PATTERNS);
  const lightHits = countPatternHits(text, LIGHT_PATTERNS);
  const isMultiFile = /(\bmultiarchivo\b|\bmulti-file\b|\bvarios archivos\b|\bmultiple files\b)/u.test(text);
  const isSimple = /(\bsimple\b|\bpequeno\b|\bsmall\b|\bquick\b|\brapido\b|\bmejorar redaccion\b)/u.test(text);
  const isHighRisk = /(\bproduction\b|\bprod\b|\bseguridad\b|\bsecurity\b|\bregresion\b|\bregression\b|\bcritico\b|\bcritical\b|\bmigracion\b|\bmigration\b)/u.test(text);

  return {
    codingHits,
    reasoningHits,
    policyHits,
    lightHits,
    isMultiFile,
    isSimple,
    isHighRisk,
    isPolicy: policyHits > 0
  };
}

function normalizeBudget(value) {
  const budget = normalizeText(value);
  if (budget === 'low' || budget === 'cheap' || budget === 'bajo' || budget === 'barato') return 'low';
  if (budget === 'high' || budget === 'premium' || budget === 'alto' || budget === 'max') return 'high';
  return 'balanced';
}

function normalizeMode(value) {
  const mode = normalizeText(value);
  if (mode === 'codex' || mode === 'coding') return 'coding';
  if (mode === 'reasoning' || mode === 'architecture' || mode === 'arquitectura') return 'reasoning';
  if (mode === 'cheap' || mode === 'lite') return 'cheap';
  return 'auto';
}

function chooseReasoningLevel(model, signals, budget, mode) {
  if (model === MODEL_CATALOG.strongGeneral || model === MODEL_CATALOG.strongCoding) return 'high';
  if (signals.isPolicy) return 'high';
  if (budget === 'low') return 'low';
  if (mode === 'coding' && model === MODEL_CATALOG.balancedGeneral) return 'medium';
  if (signals.isHighRisk || signals.isMultiFile || signals.reasoningHits >= 2) return 'high';
  if (signals.codingHits >= 2 || signals.reasoningHits >= 1) return 'medium';
  if (signals.codingHits >= 1) return 'medium';
  return 'low';
}

function chooseFallback(model) {
  if (model === MODEL_CATALOG.strongGeneral) return MODEL_CATALOG.balancedGeneral;
  if (model === MODEL_CATALOG.strongCoding) return MODEL_CATALOG.balancedGeneral;
  if (model === MODEL_CATALOG.balancedGeneral) return MODEL_CATALOG.cheapCoding;
  if (model === MODEL_CATALOG.cheapCoding) return MODEL_CATALOG.balancedGeneral;
  return MODEL_CATALOG.balancedGeneral;
}

function selectCodingModel(signals, budget, preferStrong) {
  const wantsCheap = budget === 'low';

  if (signals.isMultiFile || signals.isHighRisk || signals.reasoningHits >= 2) {
    return {
      model: MODEL_CATALOG.strongCoding,
      reasons: ['tarea de codigo compleja o multiarchivo']
    };
  }

  if (wantsCheap && signals.isSimple && signals.codingHits <= 2) {
    return {
      model: MODEL_CATALOG.cheapCoding,
      reasons: ['tarea mecanica de codigo con presupuesto bajo']
    };
  }

  if (preferStrong === true && !wantsCheap) {
    return {
      model: MODEL_CATALOG.strongCoding,
      reasons: ['preferencia explicita por calidad maxima']
    };
  }

  return {
    model: MODEL_CATALOG.balancedGeneral,
    reasons: ['tarea de codigo normal con balance costo/calidad']
  };
}

function selectReasoningModel(signals, budget) {
  if (budget === 'high' || signals.isHighRisk || signals.isMultiFile || signals.reasoningHits >= 2) {
    return {
      model: MODEL_CATALOG.strongGeneral,
      reasons: ['prioriza razonamiento/arquitectura']
    };
  }

  if (budget === 'low') {
    return {
      model: MODEL_CATALOG.balancedGeneral,
      reasons: ['caso de razonamiento con presupuesto bajo']
    };
  }

  return {
    model: MODEL_CATALOG.balancedGeneral,
    reasons: ['prioriza razonamiento/arquitectura']
  };
}

function selectPolicyModel(signals) {
  const reasons = ['solicitud de politica o estrategia de uso para Codex en VS Code'];

  if (signals.policyHits > 1) {
    reasons.push('señales multiples de politica, economia de tokens o contexto');
  }

  return {
    model: MODEL_CATALOG.strongGeneral,
    reasons
  };
}

function selectGenericModel(signals, budget) {
  if (signals.lightHits > 0 || signals.isSimple) {
    return {
      model: budget === 'low' ? MODEL_CATALOG.cheapCoding : MODEL_CATALOG.balancedGeneral,
      reasons: ['tarea ligera o de redaccion']
    };
  }

  if (budget === 'low') {
    return {
      model: MODEL_CATALOG.cheapCoding,
      reasons: ['presupuesto bajo']
    };
  }

  return {
    model: MODEL_CATALOG.balancedGeneral,
    reasons: ['seleccion generica balanceada']
  };
}

function selectModelFromSignals(signals, budget, mode, preferStrong) {
  const wantsCoding = mode === 'coding' || signals.codingHits > 0;
  const wantsReasoning = mode === 'reasoning' || signals.reasoningHits > 0;

  if (signals.isPolicy) {
    return selectPolicyModel(signals);
  }

  if (wantsReasoning && !wantsCoding) {
    return selectReasoningModel(signals, budget);
  }

  if (wantsCoding) {
    return selectCodingModel(signals, budget, preferStrong);
  }

  return selectGenericModel(signals, budget);
}

export function seleccionarModeloAutomatico(input = {}) {
  const taskText = normalizeText(
    [
      input.task,
      input.prompt,
      input.descripcion,
      input.description,
      input.context,
      input.contexto
    ]
      .filter(Boolean)
      .join(' ')
  );
  const signals = inferSignals(taskText);
  const budget = normalizeBudget(input.budget ?? input.presupuesto);
  const mode = normalizeMode(input.mode ?? input.modo);
  const { model, reasons } = selectModelFromSignals(signals, budget, mode, input.preferStrong);
  const reasoning = chooseReasoningLevel(model, signals, budget, mode);
  const fallback = chooseFallback(model);

  return {
    model,
    reasoning,
    fallback,
    budget,
    mode,
    signals,
    reasons
  };
}

function printUsage() {
  console.log(
    [
      'Uso:',
      '  node scripts/ai-model-router.mjs --task "refactor de backend" --budget balanced',
      '  node scripts/ai-model-router.mjs --task "bug multiarchivo" --json',
      '',
      'Flags:',
      '  --task, --prompt, --description',
      '  --budget low|balanced|high',
      '  --mode auto|coding|reasoning|cheap',
      '  --prefer-strong',
      '  --json'
    ].join('\n')
  );
}

function parseArgs(argv) {
  const out = {
    task: '',
    budget: 'balanced',
    mode: 'auto',
    preferStrong: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task' || arg === '--prompt' || arg === '--description') {
      out.task = String(argv[i + 1] ?? '');
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.task.trim()) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const decision = seleccionarModeloAutomatico({
    task: args.task,
    budget: args.budget,
    mode: args.mode,
    preferStrong: args.preferStrong
  });

  if (args.json) {
    console.log(JSON.stringify(decision, null, 2));
    return;
  }

  console.log(`model=${decision.model}`);
  console.log(`reasoning=${decision.reasoning}`);
  console.log(`fallback=${decision.fallback}`);
  console.log(`reasons=${decision.reasons.join(' | ')}`);
}

const isCli = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isCli) {
  main().catch((error) => {
    console.error('[ai-model-router] error inesperado:', error);
    process.exit(1);
  });
}
