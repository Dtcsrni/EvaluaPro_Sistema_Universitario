/**
 * ai-openai-client.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { enviarSolicitudAutomaticaOpenAI, resolverModeloOpenAI } from '../ai-openai-client.mjs';

test('resolverModeloOpenAI traduce etiquetas UI a ids API', () => {
  assert.equal(resolverModeloOpenAI('gpt-5.4'), 'gpt-5.4');
  assert.equal(resolverModeloOpenAI('gpt-5.4-mini'), 'gpt-5-mini');
  assert.equal(resolverModeloOpenAI('gpt-5.3-codex'), 'gpt-5-codex');
});

test('enviarSolicitudAutomaticaOpenAI construye solicitud responses correcta', async () => {
  let bodyJson = null;

  const result = await enviarSolicitudAutomaticaOpenAI({
    task: 'Bug complejo multiarchivo',
    prompt: 'Corrige el fallo y agrega pruebas',
    apiKey: 'sk-test',
    fetchImpl: async (_url, options) => {
      bodyJson = JSON.parse(String(options.body));
      return new Response(
        JSON.stringify({
          id: 'resp_123',
          output_text: 'hecho'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
  });

  assert.equal(result.apiModel, 'gpt-5-codex');
  assert.equal(result.text, 'hecho');
  assert.equal(bodyJson.model, 'gpt-5-codex');
  assert.equal(bodyJson.store, false);
  assert.match(String(bodyJson.instructions), /precisi/i);
  assert.match(String(bodyJson.input), /Bug complejo multiarchivo/);
});

test('enviarSolicitudAutomaticaOpenAI omite reasoning para modelo ligero', async () => {
  let bodyJson = null;

  await enviarSolicitudAutomaticaOpenAI({
    task: 'Renombra helper y actualiza docs',
    budget: 'low',
    apiKey: 'sk-test',
    fetchImpl: async (_url, options) => {
      bodyJson = JSON.parse(String(options.body));
      return new Response(
        JSON.stringify({
          id: 'resp_456',
          output_text: 'ok'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
  });

  assert.equal(bodyJson.model, 'gpt-5-mini');
  assert.equal(bodyJson.reasoning, undefined);
});

