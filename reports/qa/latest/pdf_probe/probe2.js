const fs=require('fs');
const mod=require('pdf-parse');
const { PDFParse } = mod;
const file=String.raw`o:\\Descargas\\evaluapro_paquete_examenes_materia-Logica_de_Programacion_plantilla-Primer_Parcial_total-15_lote-A050929D.pdf`;
(async()=>{
  if(!fs.existsSync(file)){ console.log('NO_PDF'); return; }
  const parser = new PDFParse({ data: fs.readFileSync(file) });
  const text = await parser.getText();
  const content = (text?.text || '');
  const matches=[...content.matchAll(/EXAMEN:([A-Z0-9]{8}):P(\d+):TV(\d+)/g)].map(m=>m[0]);
  const folios=[...new Set(matches.map(m=>m.split(':')[1]))].sort();
  const pnums=[...content.matchAll(/Pregunta\s+(\d{1,3})/gi)].map(m=>Number(m[1]));
  const uq=[...new Set(pnums)].sort((a,b)=>a-b);
  console.log(JSON.stringify({pages:text.total,textLen:content.length,qrMatches:matches.length,foliosCount:folios.length,foliosSample:folios.slice(0,20),preguntasCount:uq.length,preguntasSample:uq.slice(0,60)},null,2));
  await parser.destroy();
})().catch(e=>{ console.log('ERR', String(e)); process.exit(1); });
