import test from 'node:test';
import assert from 'node:assert/strict';
import { countSuccessfulStreak, evaluateStreak } from '../release/check-ci-streak.mjs';

function makeRuns(sequence) {
  return sequence.map((conclusion, index) => ({ id: index + 1, conclusion }));
}

test('ci streak falla con menos de 10 corridas success consecutivas', () => {
  const runs = makeRuns(['success', 'success', 'failure', 'success']);
  assert.equal(countSuccessfulStreak(runs), 2);
  assert.equal(evaluateStreak(runs, 10).ok, false);
});

test('ci streak pasa con 10+ corridas success consecutivas', () => {
  const runs = makeRuns([
    'success',
    'success',
    'success',
    'success',
    'success',
    'success',
    'success',
    'success',
    'success',
    'success',
    'failure'
  ]);
  const verdict = evaluateStreak(runs, 10);
  assert.equal(verdict.streak, 10);
  assert.equal(verdict.ok, true);
});

test('ci streak ignora corridas canceladas o neutrales sin bajar el umbral', () => {
  const runs = makeRuns([
    'success',
    'success',
    'cancelled',
    'success',
    'skipped',
    'success',
    'neutral',
    'success',
    'success',
    'success',
    'success',
    'success',
    'success',
    'failure'
  ]);
  const verdict = evaluateStreak(runs, 10);
  assert.equal(verdict.streak, 10);
  assert.equal(verdict.ok, true);
});
