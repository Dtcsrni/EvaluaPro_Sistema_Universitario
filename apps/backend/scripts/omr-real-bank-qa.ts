/**
 * QA local de estilo con reactivos publicados reales, sin persistencia académica.
 * Los PDF contienen reactivos del docente: nunca subir a CI ni al repositorio.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PDFParse } from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';
import { detectarColisionesDuplexOmr } from '../src/modulos/modulo_generacion_pdf/domain/duplexOmrGuard.js';
import { leerQrDesdeImagen } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';
import type { PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes.js';

type Reactivo = {
  id: string; estado: string; versionActual: number; legacyPreguntaId?: string;
  archivadoEn?: string | null; imagenDataUrl?: string;
  version?: { id: string; numeroVersion: number; contentHash: string; formato: string; enunciado: string;
    opciones: Array<{ clave: string; texto: string; esCorrecta: boolean }> } | null;
};
type Api = {
  recuperarSesionApi(): Promise<boolean>;
  preflight(): Promise<{ authenticated: boolean; permissions: string[] }>;
  listarPeriodos(filtros: { activo: boolean }): Promise<Array<{ id?: string; _id?: string; nombre: string }>>;
  listarReactivos(filtros: { periodoId: string; estado: string; limite: number; cursor?: string }): Promise<{ reactivos: Reactivo[]; nextCursor?: string | null }>;
  obtenerReactivo(id: string): Promise<Reactivo>;
};
const root = path.resolve(process.cwd(), '../..');
const url = process.env.EVALUAPRO_URL;
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('Define EVALUAPRO_URL con la URL de la instalación local, sin /api.');
}
const sdkUrl = pathToFileURL(path.join(root, 'scripts/api/evaluapro-client.mjs')).href;
const { EvaluaproClient } = await import(sdkUrl) as { EvaluaproClient: new (config: { baseUrl: string; token?: string; equipoId?: string }) => Api };
const api = new EvaluaproClient({ baseUrl: url, token: process.env.EVALUAPRO_TOKEN, equipoId: process.env.EVALUAPRO_EQUIPO_ID });
if (!process.env.EVALUAPRO_TOKEN && !await api.recuperarSesionApi()) throw new Error('No hay sesión API local autorizada.');
const preflight = await api.preflight();
if (!preflight.authenticated || !['banco:leer','periodos:leer'].every(p => preflight.permissions.includes(p))) {
  throw new Error('Se requiere autorización docente de lectura del banco y periodos.');
}
const policy = JSON.parse(await fs.readFile(path.join(root,'config/omr-version-policy.json'),'utf8')) as { active: { contractId: string; layoutVersion: string } };
const output = await fs.mkdtemp(path.join(os.tmpdir(),'evaluapro-qa-bancos-'));
const filtro = new Set((process.env.OMR_QA_PERIODOS ?? '').split(',').map(s=>s.trim()).filter(Boolean));
const periodos = (await api.listarPeriodos({ activo: true })).filter(p => {
  const id = p.id ?? p._id;
  return id && (!filtro.size || filtro.has(id));
});
if (!periodos.length) throw new Error('No hay periodos activos seleccionados.');
const bancos: Array<{ id: string; nombre: string; reactivos: Reactivo[] }> = [];
const exclusiones: Array<{ periodo: string; id: string }> = [];
const longitud = (r: Reactivo) => Array.from([r.version?.enunciado,...(r.version?.opciones ?? []).map(o=>o.texto)].join(' ')).length;
const rico = (r: Reactivo) => /<\s*(strong|em|u|sub|sup|span|img|table)\b|\\\(|\\\[|\x60/i.test([r.version?.enunciado,...(r.version?.opciones ?? []).map(o=>o.texto)].join(' ')) || /latex|image|rich|code|html/i.test(r.version?.formato ?? '');
for (const periodo of periodos) {
  const id = String(periodo.id ?? periodo._id);
  const items = new Map<string, Reactivo>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await api.listarReactivos({ periodoId: id, estado:'published', limite:100, ...(cursor ? {cursor} : {}) });
    for (const r of page.reactivos) {
      const v = r.version;
      if (r.estado !== 'published' || r.archivadoEn || !v || v.numeroVersion !== r.versionActual || !r.legacyPreguntaId ||
          !v.enunciado.trim() || v.opciones.length !== 5 || v.opciones.some(o=>!o.texto.trim()) ||
          v.opciones.filter(o=>o.esCorrecta === true).length !== 1) {
        exclusiones.push({periodo:id,id:r.id});
      } else items.set(r.id,r);
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error('Cursor repetido.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  bancos.push({id,nombre:periodo.nombre,reactivos:[...items.values()]});
}
type Caso = { id:string; n:number; paginas:number; preferencia?:RegExp; criterio:'mixto'|'corto'|'largo'|'rico';
  density:'balanced'|'compact'|'relaxed'; margen:number; largoHeader?:boolean; sinMarca?:boolean; fontScale?:number };
const casos: Caso[] = [
  {id:'QA-01',n:10,paginas:1,preferencia:/ingenier.a de software/i,criterio:'mixto',density:'balanced',margen:8},
  {id:'QA-02',n:15,paginas:2,preferencia:/aplicaciones web/i,criterio:'largo',density:'balanced',margen:8},
  {id:'QA-03',n:20,paginas:2,preferencia:/aut.matas/i,criterio:'rico',density:'balanced',margen:10,largoHeader:true},
  {id:'QA-04',n:25,paginas:2,preferencia:/electr.nica/i,criterio:'rico',density:'balanced',margen:8},
  {id:'QA-05',n:30,paginas:2,preferencia:/l.gica de programaci.n/i,criterio:'mixto',density:'compact',margen:8},
  {id:'QA-06',n:34,paginas:2,criterio:'corto',density:'compact',margen:8},
  {id:'QA-07',n:35,paginas:2,criterio:'corto',density:'compact',margen:8},
  {id:'QA-08',n:36,paginas:2,criterio:'corto',density:'compact',margen:8},
  {id:'QA-09',n:50,paginas:4,criterio:'largo',density:'relaxed',margen:12,largoHeader:true,fontScale:1.15},
  {id:'QA-10',n:80,paginas:6,criterio:'rico',density:'balanced',margen:8,sinMarca:true}
];
const cache = new Map<string,Reactivo>();
const report: Array<Record<string,unknown>> = [];
for (const caso of casos) {
  const elegibles = bancos.filter(b=>b.reactivos.length>=caso.n);
  const preferidos = caso.preferencia ? elegibles.filter(b=>caso.preferencia?.test(b.nombre)) : elegibles;
  const universo = preferidos.length ? preferidos : elegibles;
  const puntaje = (b:typeof bancos[number]) => caso.criterio==='rico' ? b.reactivos.filter(rico).length :
    caso.criterio==='corto' ? -b.reactivos.map(longitud).sort((a,b)=>a-b).slice(0,caso.n).reduce((a,b)=>a+b,0) :
    caso.criterio==='largo' ? b.reactivos.map(longitud).sort((a,b)=>b-a).slice(0,caso.n).reduce((a,b)=>a+b,0) : b.reactivos.length;
  const banco = [...universo].sort((a,b)=>puntaje(b)-puntaje(a)||a.id.localeCompare(b.id))[0];
  if (!banco) {
    report.push({caso:caso.id,estado:'no_aplicable',motivo:'Ningún banco individual tiene suficientes reactivos publicados',solicitados:caso.n});
    continue;
  }
  const ordenados = [...banco.reactivos].sort((a,b)=>
    (caso.criterio==='corto'?longitud(a)-longitud(b):caso.criterio==='largo'?longitud(b)-longitud(a):
      caso.criterio==='rico'?Number(rico(b))-Number(rico(a))||longitud(b)-longitud(a):0)||a.id.localeCompare(b.id));
  const seleccion = caso.criterio==='mixto' ? ordenados.filter((_r,i)=>i%Math.max(1,Math.floor(ordenados.length/caso.n))===0).slice(0,caso.n) : ordenados.slice(0,caso.n);
  const dir = path.join(output,caso.id);
  await fs.mkdir(dir);
  try {
    const preguntas: PreguntaBase[] = [];
    const versiones: Array<Record<string,unknown>> = [];
    for (const r of seleccion) {
      const detail = cache.get(r.id) ?? await api.obtenerReactivo(r.id);
      cache.set(r.id,detail);
      if (detail.estado!=='published' || !detail.legacyPreguntaId || !detail.version || detail.version.id!==r.version?.id || detail.version.contentHash!==r.version?.contentHash) {
        throw new Error('El banco cambió durante la lectura.');
      }
      preguntas.push({id:detail.legacyPreguntaId,enunciado:detail.version.enunciado,
        ...(detail.imagenDataUrl?{imagenUrl:detail.imagenDataUrl}:{}),
        opciones:detail.version.opciones.map(o=>({texto:o.texto,esCorrecta:o.esCorrecta}))});
      versiones.push({id:r.id,versionId:detail.version.id,contentHash:detail.version.contentHash});
    }
    if (preguntas.length!==caso.n || new Set(preguntas.map(p=>p.id)).size!==caso.n) throw new Error('Selección incompleta o duplicada.');
    const examId = randomUUID();
    const folio = examId.replace(/-/g,'').slice(0,8).toUpperCase();
    const resultado = await generarPdfExamen({
      titulo:'QA - NO APLICAR',folio,examId,preguntas,tipoExamen:'parcial',
      totalPaginas:caso.paginas,margenMm:caso.margen,
      mapaVariante:{ordenPreguntas:preguntas.map(p=>p.id),ordenOpcionesPorPregunta:Object.fromEntries(preguntas.map(p=>[p.id,[0,1,2,3,4]]))},
      bookletConfig:{densityMode:caso.density,fontScale:caso.fontScale??1,lineSpacing:1,autoFitPages:false,autoFitTypography:false},
      encabezado:{institucion:'Centro Universitario Hidalguense',materia:banco.nombre,
        docente:caso.largoHeader?'Docente de control de calidad de la plantilla de evaluación institucional':'Docente QA',
        mostrarMarcaInstitucional:!caso.sinMarca,mostrarInstrucciones:true,
        instrucciones:caso.largoHeader?'Lea cada reactivo con atención. Marque una sola respuesta sin tocar el borde del círculo. Si cambia la respuesta, borre completamente la marca anterior. Revise el folio y la integridad de todas las hojas antes de entregar.':undefined,
        alumno:{nombre:'Alumno Prueba Calidad',iniciales:'APC',grupo:'QA'}}
    });
    await fs.writeFile(path.join(dir,'examen.pdf'),resultado.pdfBytes);
    await fs.writeFile(path.join(dir,'mapa.json'),JSON.stringify(resultado.mapaOmr,null,2));
    const issues:string[]=[];
    if (resultado.mapaOmr.templateId!==policy.active.contractId) issues.push('Contrato OMR inesperado');
    const mapeadas=resultado.mapaOmr.paginas.flatMap(p=>p.preguntas);
    if (resultado.preguntasRestantes!==0 || JSON.stringify(mapeadas.map(p=>p.idPregunta))!==JSON.stringify(preguntas.map(p=>p.id))) issues.push('Orden/cobertura incorrectos');
    if (mapeadas.some(p=>p.opciones.length!==5)) issues.push('Cantidad de burbujas incorrecta');
    if (detectarColisionesDuplexOmr(resultado.mapaOmr).length) issues.push('Colisión dúplex');
    for (const p of resultado.mapaOmr.paginas) {
      if (p.layoutDebug?.collisionBoxes?.length || p.layoutDebug?.lineHeightViolations?.length) issues.push('Colisión o tipografía: página '+p.numeroPagina);
    }
    const doc=await PDFDocument.load(resultado.pdfBytes);
    if (doc.getPages().some(p=>p.getWidth()!==612 || p.getHeight()!==792)) issues.push('Página distinta de Carta');
    const parser=new PDFParse({data:resultado.pdfBytes});
    let qrValidados=0;
    try {
      for (const dpi of [150,300]) {
        const capturas=await parser.getScreenshot({partial:doc.getPages().map((_p,i)=>i+1),desiredWidth:Math.round(8.5*dpi),imageBuffer:true,imageDataUrl:false});
        if (capturas.pages.length!==doc.getPageCount()) issues.push('Raster incompleto a '+dpi+' DPI');
        for (const [i,captura] of capturas.pages.entries()) {
          const image=Buffer.from(captura.data);
          await fs.writeFile(path.join(dir,'p'+(i+1)+'-'+dpi+'dpi.png'),image);
          const pageMap=resultado.mapaOmr.paginas[i];
          if (!pageMap?.qr?.texto) {
            if (pageMap?.tipoPagina!=='reverso-vacio') issues.push('Mapa sin QR en página '+(i+1));
            continue;
          }
          if (await leerQrDesdeImagen('data:image/png;base64,'+image.toString('base64'))!==pageMap.qr.texto) issues.push('QR distinto: página '+(i+1)+' a '+dpi+' DPI');
          else qrValidados++;
        }
      }
    } finally {await parser.destroy();}
    report.push({caso:caso.id,estado:issues.length?'fallido':'validado_geometricamente',banco:banco.nombre,periodoId:banco.id,versiones,solicitados:caso.n,paginasObjetivo:caso.paginas,paginasReales:doc.getPageCount(),excedeObjetivo:doc.getPageCount()>caso.paginas,reactivosRicos:seleccion.filter(rico).length,imagenes:preguntas.filter(p=>p.imagenUrl).length,qrValidados,sha256:createHash('sha256').update(resultado.pdfBytes).digest('hex'),issues,inspeccionHumana:'pendiente'});
  } catch(e) {
    report.push({caso:caso.id,estado:'fallido',banco:banco.nombre,periodoId:banco.id,solicitados:caso.n,error:e instanceof Error?e.message:String(e)});
  }
}
await fs.writeFile(path.join(output,'reporte.json'),JSON.stringify({contrato:policy.active,bancos:bancos.map(b=>({id:b.id,nombre:b.nombre,disponibles:b.reactivos.length})),exclusiones,casos:report},null,2));
process.stdout.write(JSON.stringify({output,resultados:report.map(({caso,estado})=>({caso,estado}))})+'\n');
if (report.some(r=>r.estado==='fallido') || !report.some(r=>r.estado==='validado_geometricamente')) process.exitCode=1;
