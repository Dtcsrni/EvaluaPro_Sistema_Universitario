import { describe, expect, it } from 'vitest';
import { createDecipheriv, createHmac, webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';
import { generarHtmlCalificaciones } from '../src/modulos/modulo_analiticas/servicioExportacionHtmlCalificaciones.js';
import type { ListaAcademicaFila } from '../src/modulos/modulo_analiticas/tiposListaAcademica.js';
import { esquemaExportarHtmlCalificaciones } from '../src/modulos/modulo_analiticas/validacionesAnaliticas.js';

const filaBase = {
  matricula: 'A001',
  nombre: 'Ana',
  apellidoPaterno: 'Pérez',
  apellidoMaterno: 'López',
  grupo: '1A',
  parcial1: '8',
  parcial2: '',
  global: '9',
  calificacionFinalCurso: ''
} as ListaAcademicaFila;

function contraste(hexA: string, hexB: string): number {
  const luminancia = (hex: string): number => {
    const canales = hex.match(/[0-9a-f]{2}/gi)?.map((canal) => Number.parseInt(canal, 16) / 255) ?? [];
    const [r, g, b] = canales.map((canal) => canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [claro, oscuro] = [luminancia(hexA), luminancia(hexB)].sort((a, b) => b - a);
  return (claro! + 0.05) / (oscuro! + 0.05);
}

describe('reporte HTML de calificaciones', () => {
  it('genera un documento autocontenido y escapa contenido dinámico', () => {
    const fila = { ...filaBase, nombre: '<img src=x onerror=alert(1)>', correo: 'privado@example.test' } as ListaAcademicaFila;
    const { html } = generarHtmlCalificaciones({
      nombrePeriodo: 'Cálculo <Avanzado>',
      cicloLectivo: '2026–2027',
      filas: [fila],
      generadoEn: new Date('2026-10-28T12:00:00.000Z')
    });

    expect(html).toContain('<html lang="es-MX">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('Cálculo &lt;Avanzado&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('privado@example.test');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('https://');
    expect(html).toContain('<th scope="col">Final del curso</th>');
    expect(html).toContain('>8</td>');
    expect(html).toContain('Sin registro');
    expect(html).not.toContain('>0</td>');
    expect(html).toContain('no confirma que los resultados estén publicados');
  });

  it('representa correctamente un periodo sin alumnos', () => {
    const { html } = generarHtmlCalificaciones({ nombrePeriodo: 'Álgebra', cicloLectivo: '', filas: [] });
    expect(html).toContain('0 alumnos · calificaciones registradas');
    expect(html).toContain('No hay alumnos registrados para este periodo.');
  });

  it('refluye el reporte grupal a fichas móviles y mantiene una tabla accesible para escritorio e impresión', () => {
    const segundaFila = { ...filaBase, matricula: 'A002', nombre: 'Luis', parcial1: '7' } as ListaAcademicaFila;
    const { html } = generarHtmlCalificaciones({
      nombrePeriodo: 'Álgebra',
      cicloLectivo: '2026–2027',
      filas: [filaBase, segundaFila]
    });
    const dom = new JSDOM(html);
    const scrollRegion = dom.window.document.querySelector('.table-wrap');
    const cards = [...dom.window.document.querySelectorAll('.grade-card')];

    expect(scrollRegion?.getAttribute('role')).toBe('region');
    expect(scrollRegion?.getAttribute('tabindex')).toBe('0');
    expect(scrollRegion?.getAttribute('aria-labelledby')).toBe('tabla-calificaciones-titulo');
    expect(dom.window.document.getElementById('tabla-calificaciones-ayuda')?.textContent).toMatch(/pantallas estrechas.*fichas individuales/i);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.querySelector('h2')?.textContent).toBe('Ana Pérez López');
    expect(cards[0]?.textContent).toContain('MatrículaA001');
    expect(cards[0]?.textContent).toContain('Parcial 2Sin registro');
    expect(html).toContain('@media(max-width:800px){.grades-table-view{display:none}.grade-card-view{display:block}}');
    expect(html).toContain('@media print{ :root{background:#fff}');
    expect(html).toContain('.grades-table-view{display:block!important}.grade-card-view{display:none!important}');
    dom.window.close();
  });

  it('mantiene un foco visible con contraste suficiente sobre las superficies claras del reporte', () => {
    const { html } = generarHtmlCalificaciones({ nombrePeriodo: 'Álgebra', cicloLectivo: '', filas: [] });
    const foco = html.match(/button:focus-visible,input:focus-visible\{outline:3px solid (#[0-9a-f]{6});outline-offset:2px\}/i)?.[1];

    expect(foco).toBe('#005ea8');
    expect(contraste(foco!, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contraste(foco!, '#f3f6fb')).toBeGreaterThanOrEqual(3);
  });

  it('cifra la consulta individual y solo revela una fila tras la clave y matrícula en el HTML', () => {
    const secreto = 'Secreto-maestro-de-ciclo-2026-seguro';
    const segundaFila = { ...filaBase, matricula: 'A002', nombre: 'Luis', parcial1: '6' } as ListaAcademicaFila;
    const { html, credenciales } = generarHtmlCalificaciones({
      nombrePeriodo: 'Álgebra', cicloLectivo: 'Enero-Junio 2026', filas: [filaBase, segundaFila], modo: 'individual', secretoCiclo: secreto
    });
    const registros = JSON.parse(html.match(/const records=(\[[\s\S]*?\]);/)?.[1] ?? '[]') as Array<{ id: string; iv: string; data: string }>;
    expect(credenciales).toHaveLength(2);
    expect(credenciales[0].clave).not.toBe(credenciales[1].clave);
    expect(credenciales).toEqual(generarHtmlCalificaciones({
      nombrePeriodo: 'Álgebra', cicloLectivo: 'Enero-Junio 2026', filas: [filaBase, segundaFila], modo: 'individual', secretoCiclo: secreto
    }).credenciales);
    expect(credenciales[0].clave).not.toBe(generarHtmlCalificaciones({
      nombrePeriodo: 'Álgebra', cicloLectivo: 'Febrero-Junio 2026', filas: [filaBase, segundaFila], modo: 'individual', secretoCiclo: secreto
    }).credenciales[0].clave);
    expect(html).not.toContain(secreto);
    expect(html).not.toContain('A001');
    expect(html).not.toContain('Ana');
    expect(html).not.toContain('Pérez');
    expect(html).toContain('crypto.subtle.decrypt');
    expect(html).toContain('name="matricula"');
    expect(html).toContain('name="clave"');

    const clave = Buffer.from(credenciales[0].clave, 'base64url');
    const registroId = createHmac('sha256', clave).update('EvaluaPro/consulta-individual/lookup/v1').digest().subarray(0, 16).toString('base64url');
    const registro = registros.find((item) => item.id === registroId);
    expect(registro).toBeDefined();
    const paquete = Buffer.from(registro!.data, 'base64');
    const descifrador = createDecipheriv('aes-128-gcm', clave, Buffer.from(registro!.iv, 'base64'));
    descifrador.setAuthTag(paquete.subarray(paquete.length - 16));
    const plano = Buffer.concat([descifrador.update(paquete.subarray(0, -16)), descifrador.final()]).toString('utf8');
    expect(JSON.parse(plano)).toEqual(expect.objectContaining({ matricula: 'A001', alumno: 'Ana Pérez López' }));
    const registroAjeno = registros.find((item) => item.id !== registroId)!;
    const descifradorAjeno = createDecipheriv('aes-128-gcm', clave, Buffer.from(registroAjeno.iv, 'base64'));
    descifradorAjeno.setAuthTag(Buffer.from(registroAjeno.data, 'base64').subarray(-16));
    expect(() => {
      const ciphertextAjeno = Buffer.from(registroAjeno.data, 'base64').subarray(0, -16);
      descifradorAjeno.update(ciphertextAjeno);
      descifradorAjeno.final();
    }).toThrow();
  });

  it('explica y valida el formato base64url exacto de la clave individual', () => {
    const { html, credenciales } = generarHtmlCalificaciones({
      nombrePeriodo: 'Álgebra',
      cicloLectivo: 'Enero-Junio 2026',
      filas: [filaBase],
      modo: 'individual',
      secretoCiclo: 'Secreto-maestro-de-ciclo-2026-seguro'
    });
    const clave = credenciales[0].clave;
    const dom = new JSDOM(html);
    const campo = dom.window.document.getElementById('clave') as HTMLInputElement;
    const formato = new RegExp(`^(?:${campo.getAttribute('pattern')})$`);

    expect(clave).toHaveLength(22);
    expect(clave).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(campo.getAttribute('minlength')).toBe('22');
    expect(campo.getAttribute('maxlength')).toBe('22');
    expect(campo.getAttribute('pattern')).toBe('[A-Za-z0-9_-]{22}');
    expect(campo.getAttribute('aria-describedby')).toBe('clave-ayuda');
    expect(dom.window.document.getElementById('clave-ayuda')?.textContent).toMatch(/22 caracteres.*distingue mayúsculas de minúsculas/i);

    expect(formato.test(clave)).toBe(true);
    expect(formato.test(clave.slice(1))).toBe(false);
    expect(formato.test(`${clave.slice(0, -1)}!`)).toBe(false);
    dom.window.close();
  });

  it('permite mostrar y ocultar la clave personal sin enviar ni cambiar su valor', () => {
    const { html, credenciales } = generarHtmlCalificaciones({
      nombrePeriodo: 'Álgebra',
      cicloLectivo: 'Enero-Junio 2026',
      filas: [filaBase],
      modo: 'individual',
      secretoCiclo: 'Secreto-maestro-de-ciclo-2026-seguro'
    });
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://evaluapro.test/reporte.html' });
    const clave = dom.window.document.getElementById('clave') as HTMLInputElement;
    const boton = dom.window.document.getElementById('alternar-visibilidad-clave') as HTMLButtonElement;
    clave.value = credenciales[0].clave;

    expect(clave.type).toBe('password');
    expect(boton.type).toBe('button');
    expect(boton.getAttribute('aria-controls')).toBe('clave');
    expect(boton.textContent).toBe('Mostrar clave');
    expect(html).toMatch(/\.secret-field button\{[^}]*background:#fff;color:#205fb1/i);
    expect(contraste('#205fb1', '#ffffff')).toBeGreaterThanOrEqual(4.5);

    boton.click();
    expect(clave.type).toBe('text');
    expect(clave.value).toBe(credenciales[0].clave);
    expect(boton.textContent).toBe('Ocultar clave');

    boton.click();
    expect(clave.type).toBe('password');
    expect(clave.value).toBe(credenciales[0].clave);
    expect(boton.textContent).toBe('Mostrar clave');
    dom.window.close();
  });

  it('ejecuta la consulta offline con Web Crypto y muestra solo la matrícula coincidente', async () => {
    const secreto = 'Secreto-maestro-de-ciclo-2026-seguro';
    const { html, credenciales } = generarHtmlCalificaciones({
      nombrePeriodo: 'Álgebra', cicloLectivo: 'Enero-Junio 2026', filas: [filaBase], modo: 'individual', secretoCiclo: secreto
    });
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://evaluapro.test/reporte.html' });
    Object.defineProperty(dom.window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
    Object.defineProperty(dom.window, 'TextEncoder', { configurable: true, value: TextEncoder });
    Object.defineProperty(dom.window, 'TextDecoder', { configurable: true, value: TextDecoder });
    const registros = JSON.parse(html.match(/const records=(\[[\s\S]*?\]);/)?.[1] ?? '[]') as Array<{ id: string }>;
    const claveBytes = Buffer.from(credenciales[0].clave, 'base64url');
    const hmacKey = await webcrypto.subtle.importKey('raw', claveBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const lookupHash = await webcrypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode('EvaluaPro/consulta-individual/lookup/v1'));
    const lookupId = btoa(String.fromCharCode(...new Uint8Array(lookupHash).slice(0, 16))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    expect(registros[0]?.id).toBe(lookupId);
    (dom.window.document.getElementById('matricula') as HTMLInputElement).value = 'A001';
    (dom.window.document.getElementById('clave') as HTMLInputElement).value = credenciales[0].clave;
    dom.window.document.getElementById('consulta-form')?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(dom.window.document.getElementById('estado')?.textContent).toBe('Resultado disponible para esta matrícula.');
    expect(dom.window.document.getElementById('resultado')?.textContent).toContain('Ana Pérez López');
    expect(dom.window.document.getElementById('resultado')?.textContent).toContain('8');
    expect((dom.window.document.getElementById('clave') as HTMLInputElement).value).toBe('');
    dom.window.close();
  });

  it('requiere un secreto maestro de 20 caracteres para modo individual y lo rechaza en modo grupal', () => {
    const base = { periodoId: '00000000-0000-4000-8000-000000000001' };
    expect(esquemaExportarHtmlCalificaciones.safeParse({ ...base, modo: 'individual' }).success).toBe(false);
    expect(esquemaExportarHtmlCalificaciones.safeParse({ ...base, modo: 'individual', secretoCiclo: 'Secreto-corto' }).success).toBe(false);
    expect(esquemaExportarHtmlCalificaciones.safeParse({ ...base, modo: 'grupo', secretoCiclo: 'Secreto-maestro-largo-2026' }).success).toBe(false);
    expect(esquemaExportarHtmlCalificaciones.safeParse({ ...base, modo: 'individual', secretoCiclo: 'Secreto-maestro-de-ciclo-2026-seguro' }).success).toBe(true);
  });
});
