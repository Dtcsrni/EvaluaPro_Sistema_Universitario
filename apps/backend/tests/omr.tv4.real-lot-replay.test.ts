import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsearArgsReplayReal,
  resolverImagenLoteReal,
  validarManifestLoteReal,
  validarPlantillaVigenteReplay
} from '../scripts/omr-tv4-real-lot-replay.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const activeTemplatePolicy = JSON.parse(readFileSync(path.join(repoRoot, 'config/omr-version-policy.json'), 'utf8')) as {
  active: { templateVersion: number; contractId: string; wireMarker: string };
};
const TEMPLATE_ID = activeTemplatePolicy.active.contractId;
const TEMPLATE_VERSION = activeTemplatePolicy.active.templateVersion;
const LATEST_ENGINEERING_SOFTWARE_LOT = '644A8439';

function capture(page: number, question: number, lotId = 'TESTLOT', signed = false) {
  const qr = `EXAMEN:TESTFOLIO:P${page}:${activeTemplatePolicy.active.wireMarker}${signed ? `:LI:${lotId}:KI:QR-H1-V1:SG:H000000000000000000000000` : ''}`;
  return {
    imageFile: `page-${page}.jpg`,
    folio: 'TESTFOLIO',
    sourcePage: page,
    loteQr: lotId,
    qrEsperado: qr,
    mapaPagina: {
      numeroPagina: page,
      templateVersion: TEMPLATE_VERSION,
      templateId: TEMPLATE_ID,
      qr: { texto: qr },
      preguntas: [{ numeroPregunta: question }]
    }
  };
}

function syntheticLatestLotPages() {
  return Array.from({ length: 4 }, (_folio, folioIndex) => {
    const folio = `TEST-FOLIO-${folioIndex + 1}`;
    return [1, 2].map((page) => {
      const firstQuestion = folioIndex * 22 + (page - 1) * 11 + 1;
      const questions = Array.from({ length: 11 }, (_question, index) => ({ numeroPregunta: firstQuestion + index }));
      const qr = `EXAMEN:${folio}:P${page}:${activeTemplatePolicy.active.wireMarker}`;
      return {
        imageFile: `${folio}-page-${page}.jpg`,
        folio,
        sourcePage: page,
        loteQr: LATEST_ENGINEERING_SOFTWARE_LOT,
        qrEsperado: qr,
        mapaPagina: {
          numeroPagina: page,
          templateVersion: TEMPLATE_VERSION,
          templateId: TEMPLATE_ID,
          qr: { texto: qr },
          preguntas: questions
        }
      };
    });
  }).flat();
}

const options = {
  loteIds: ['TESTLOT'],
  templateId: TEMPLATE_ID,
  templateVersion: TEMPLATE_VERSION,
  expectedPages: 2,
  expectedFolios: 1
};

describe('contrato de replay del último lote con la plantilla OMR activa', () => {
  it('fija el lote actual de Ingeniería de Software a 8 páginas y 4 folios con capturas sintéticas', () => {
    expect(activeTemplatePolicy.active).toMatchObject({
      contractId: 'omr-canonical-1.0.0',
      templateVersion: 4,
      wireMarker: 'O1.1.0'
    });
    const lotOptions = {
      loteIds: [LATEST_ENGINEERING_SOFTWARE_LOT],
      templateId: TEMPLATE_ID,
      templateVersion: TEMPLATE_VERSION,
      expectedPages: 8,
      expectedFolios: 4
    };
    const result = validarManifestLoteReal({
      pages: syntheticLatestLotPages()
    }, lotOptions);
    expect(result).toMatchObject({ folioCount: 4, questionCount: 88 });
    expect(() => validarPlantillaVigenteReplay({ templateId: TEMPLATE_ID, templateVersion: TEMPLATE_VERSION }, activeTemplatePolicy))
      .not.toThrow();
    expect(() => validarPlantillaVigenteReplay({ templateId: TEMPLATE_ID, templateVersion: TEMPLATE_VERSION - 1 }, activeTemplatePolicy))
      .toThrow('solo admite la plantilla OMR activa');
  });

  it('exige fijar manifiesto, lote y versión exacta de la plantilla a probar', () => {
    expect(parsearArgsReplayReal([
      'node', 'script.ts', '--manifest', 'manifest.json', '--lot-id', 'TESTLOT',
      '--template-id', TEMPLATE_ID, '--template-version', String(TEMPLATE_VERSION), '--expected-pages', '8',
      '--require-eligible'
    ])).toMatchObject({
      manifest: 'manifest.json',
      loteIds: ['TESTLOT'],
      templateId: TEMPLATE_ID,
      templateVersion: 4,
      expectedPages: 8,
      requireEligible: true
    });
    expect(() => parsearArgsReplayReal(['node', 'script.ts', '--manifest', 'manifest.json']))
      .toThrow('--lot-id');
    expect(parsearArgsReplayReal([
      'node', 'script.ts', '--manifest', 'manifest.json', '--lot-id', LATEST_ENGINEERING_SOFTWARE_LOT,
      '--template-id', TEMPLATE_ID, '--template-version', String(TEMPLATE_VERSION), '--expected-pages', '8', '--expected-folios', '4', '--reader-only'
    ])).toMatchObject({ loteIds: [LATEST_ENGINEERING_SOFTWARE_LOT], expectedPages: 8, expectedFolios: 4, readerOnly: true });
  });

  it('acepta únicamente las páginas del lote y plantilla exactos con cobertura por folio', () => {
    const result = validarManifestLoteReal({ pages: [capture(1, 1), capture(2, 2)] }, options);
    expect(result).toMatchObject({ folioCount: 1, questionCount: 2 });
  });

  it('rechaza páginas de una plantilla anterior aunque el lote coincida', () => {
    const oldTemplate = capture(1, 1);
    oldTemplate.mapaPagina.templateVersion = TEMPLATE_VERSION - 1;
    expect(() => validarManifestLoteReal({ pages: [oldTemplate, capture(2, 2)] }, options))
      .toThrow('no coincide con la plantilla solicitada');
  });

  it('solo el modo de lectura permite QR con firma no verificable y nunca habilita calificación', () => {
    const signedPage = capture(1, 1, 'TESTLOT', true);
    const signedOptions = { ...options, expectedPages: 1, allowUnverifiedSignatures: false };
    expect(() => validarManifestLoteReal({ pages: [signedPage] }, signedOptions))
      .toThrow('Firma HMAC del QR inválida o no disponible (keyId=QR-H1-V1)');
    expect(validarManifestLoteReal({ pages: [signedPage] }, { ...signedOptions, allowUnverifiedSignatures: true }))
      .toMatchObject({ folioCount: 1, questionCount: 1 });
    expect(() => parsearArgsReplayReal([
      'node', 'script.ts', '--manifest', 'manifest.json', '--lot-id', 'TESTLOT',
      '--template-id', TEMPLATE_ID, '--template-version', String(TEMPLATE_VERSION), '--reader-only', '--require-eligible'
    ])).toThrow('--reader-only');
  });

  it('rechaza QR conflictivo, página duplicada y cobertura incompleta', () => {
    const qrMismatch = capture(1, 1);
    qrMismatch.mapaPagina.qr.texto = 'EXAMEN:OTROFOLIO:P1:O1.1.0';
    expect(() => validarManifestLoteReal({ pages: [qrMismatch, capture(2, 2)] }, options))
      .toThrow('no identifica exactamente');

    expect(() => validarManifestLoteReal({ pages: [capture(1, 1), capture(1, 2)] }, options))
      .toThrow('Página duplicada');
    expect(() => validarManifestLoteReal({ pages: [capture(1, 1)] }, options))
      .toThrow('se esperaban 2');
  });

  it('confina las rutas de imágenes al directorio del manifiesto', () => {
    const manifestPath = path.join(os.tmpdir(), 'qa', 'manifest.json');
    expect(() => resolverImagenLoteReal(manifestPath, '../outside.jpg')).toThrow('sale de la carpeta');
    expect(() => resolverImagenLoteReal(manifestPath, 'page.tiff')).toThrow('Formato de imagen no admitido');
    expect(resolverImagenLoteReal(manifestPath, 'page-1.jpg')).toMatchObject({
      path: path.join(os.tmpdir(), 'qa', 'page-1.jpg'),
      mimeType: 'image/jpeg'
    });
  });
});
