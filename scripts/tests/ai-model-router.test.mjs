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

