import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarSaltosLinea } from '../omr-evaluator-code-hash.mjs';

test('huella generada compara igual en checkout LF y CRLF', () => {
  const generated = 'export const fingerprint = "abc";\n';
  const windowsCheckout = generated.replace(/\n/g, '\r\n');

  assert.equal(normalizarSaltosLinea(windowsCheckout), generated);
});

test('normaliza también retornos CR aislados sin alterar el contenido', () => {
  assert.equal(normalizarSaltosLinea('a\rb\r\nc\n'), 'a\nb\nc\n');
});
