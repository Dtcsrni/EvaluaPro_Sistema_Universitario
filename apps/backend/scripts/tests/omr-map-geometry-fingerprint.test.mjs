import test from 'node:test';
import assert from 'node:assert/strict';
import { crearHuellaGeometriaMapaOmr } from '../omr-map-geometry-fingerprint.mjs';

function mapa() {
  return {
    numeroPagina: 1,
    templateVersion: 4,
    qr: { x: 540, y: 700, size: 32, texto: 'QR-IDENTIDAD-PRIVADA' },
    preguntas: [{
      numeroPregunta: 1,
      idPregunta: 'QUESTION-ID-PRIVATE',
      opciones: [
        { letra: 'B', x: 200, y: 500 },
        { letra: 'A', x: 190, y: 500 }
      ],
      fiduciales: {
        top: { x: 190, y: 505 },
        bottom: { x: 200, y: 495 }
      }
    }]
  };
}

test('huella estable ignora IDs y payload QR y normaliza orden de opciones', () => {
  const first = mapa();
  const second = mapa();
  second.qr.texto = 'QR-OTHER-PRIVATE';
  second.preguntas[0].idPregunta = 'OTHER-QUESTION-ID';
  second.preguntas[0].opciones.reverse();

  assert.equal(crearHuellaGeometriaMapaOmr(first), crearHuellaGeometriaMapaOmr(second));
  assert.match(crearHuellaGeometriaMapaOmr(first), /^[a-f0-9]{64}$/);
});

test('huella cambia cuando cambia una coordenada OMR o QR', () => {
  const original = mapa();
  const changedBubble = mapa();
  changedBubble.preguntas[0].opciones[0].x += 0.25;
  const changedQr = mapa();
  changedQr.qr.x += 0.25;

  assert.notEqual(crearHuellaGeometriaMapaOmr(original), crearHuellaGeometriaMapaOmr(changedBubble));
  assert.notEqual(crearHuellaGeometriaMapaOmr(original), crearHuellaGeometriaMapaOmr(changedQr));
});
