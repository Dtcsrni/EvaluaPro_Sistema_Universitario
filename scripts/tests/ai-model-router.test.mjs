/**
 * ai-model-router.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL_CATALOG, seleccionarModeloAutomatico } from '../ai-model-router.mjs';

test('selecciona modelo fuerte para arquitectura', () => {
  const decision = seleccionarModeloAutomatico({
    task: 'Necesito definir arquitectura, tradeoffs y plan de migracion',
    budget: 'high'
  });

  assert.equal(decision.model, MODEL_CATALOG.strongGeneral);
  assert.equal(decision.reasoning, 'high');
  assert.match(decision.reasons.join(' '), /arquitectura|razonamiento/i);
});

test('selecciona modelo fuerte para politica de economia de tokens en codex y vscode', () => {
  const decision = seleccionarModeloAutomatico({
    task: 'Quiero implementar una politica de economia de tokens para Codex en VS Code',
    budget: 'low'
  });

  assert.equal(decision.model, MODEL_CATALOG.strongGeneral);
  assert.equal(decision.reasoning, 'high');
  assert.equal(decision.mode, 'auto');
  assert.equal(decision.signals.isPolicy, true);
  assert.match(decision.reasons.join(' '), /politica|Codex|VS Code/i);
});

test('selecciona codex fuerte para bug multiarchivo', () => {
  const decision = seleccionarModeloAutomatico({
    task: 'Bug complejo multiarchivo en el backend con refactor y tests',
    mode: 'coding'
  });

  assert.equal(decision.model, MODEL_CATALOG.strongCoding);
  assert.equal(decision.reasoning, 'high');
});

test('selecciona modelo barato para tarea mecanica', () => {
  const decision = seleccionarModeloAutomatico({
    task: 'Renombra este helper y actualiza docs simples',
    budget: 'low'
  });

  assert.equal(decision.model, MODEL_CATALOG.cheapCoding);
  assert.equal(decision.reasoning, 'low');
});

test('selecciona balanceado para coding normal', () => {
  const decision = seleccionarModeloAutomatico({
    task: 'Implementa una utilidad de validacion con pruebas',
    mode: 'coding'
  });

  assert.equal(decision.model, MODEL_CATALOG.balancedGeneral);
  assert.equal(decision.reasoning, 'medium');
  assert.equal(decision.fallback, MODEL_CATALOG.cheapCoding);
});

test('mantiene salida estable en tareas normales de desarrollo', () => {
  const decision = seleccionarModeloAutomatico({
    task: 'Implementa una utilidad de validacion con pruebas',
    mode: 'coding'
  });

  assert.deepEqual(
    Object.keys(decision).sort(),
    ['budget', 'fallback', 'mode', 'model', 'reasoning', 'reasons', 'signals']
  );
  assert.equal(typeof decision.signals, 'object');
  assert.equal(Array.isArray(decision.reasons), true);
});
