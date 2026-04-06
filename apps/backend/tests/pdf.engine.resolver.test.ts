import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolverPdfEngine } from '../src/modulos/modulo_generacion_pdf/infra/resolverPdfEngine';

const prevEngine = process.env.EXAMEN_PDF_ENGINE;
const prevExec = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const prevChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
const prevNodeEnv = process.env.NODE_ENV;

function restoreEnv() {
  if (prevEngine === undefined) delete process.env.EXAMEN_PDF_ENGINE;
  else process.env.EXAMEN_PDF_ENGINE = prevEngine;

  if (prevExec === undefined) delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  else process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = prevExec;

  if (prevChannel === undefined) delete process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  else process.env.PLAYWRIGHT_BROWSER_CHANNEL = prevChannel;

  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;
}

function clearResolverEnv() {
  delete process.env.EXAMEN_PDF_ENGINE;
  delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  delete process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  delete process.env.NODE_ENV;
}

afterEach(() => {
  clearResolverEnv();
  restoreEnv();
});

describe('resolverPdfEngine', () => {
  it('respeta override explícito a pdf-lib-legacy', () => {
    clearResolverEnv();
    process.env.EXAMEN_PDF_ENGINE = 'pdf-lib-legacy';
    expect(resolverPdfEngine()).toBe('pdf-lib-legacy');
  });

  it('respeta override explícito a playwright-html-v1', () => {
    clearResolverEnv();
    process.env.EXAMEN_PDF_ENGINE = 'playwright-html-v1';
    expect(resolverPdfEngine()).toBe('playwright-html-v1');
  });

  it('usa playwright cuando executable path existe', () => {
    clearResolverEnv();
    const tmpFile = path.join(os.tmpdir(), `evaluapro-playwright-${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, 'ok');
    try {
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = tmpFile;
      expect(resolverPdfEngine()).toBe('playwright-html-v1');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('usa fallback cuando executable path no existe', () => {
    clearResolverEnv();
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = path.join(os.tmpdir(), 'no-existe', 'chromium');
    expect(resolverPdfEngine()).toBe('pdf-lib-legacy');
  });

  it('en production sin canal fuerza pdf-lib-legacy', () => {
    clearResolverEnv();
    process.env.NODE_ENV = 'production';
    expect(resolverPdfEngine()).toBe('pdf-lib-legacy');
  });

  it('en production con canal permite playwright', () => {
    clearResolverEnv();
    process.env.NODE_ENV = 'production';
    process.env.PLAYWRIGHT_BROWSER_CHANNEL = 'chromium';
    expect(resolverPdfEngine()).toBe('playwright-html-v1');
  });
});
