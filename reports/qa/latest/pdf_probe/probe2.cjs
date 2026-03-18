const fs=require('fs');
const {PDFParse}=require('pdf-parse');
(async()=>{
  const file=String.raw`o:\\Descargas\\evaluapro_paquete_examenes_materia-Logica_de_Programacion_plantilla-Primer_Parcial_total-15_lote-A050929D.pdf`;
  if(!fs.existsSync(file)){ console.log('NO_PDF'); return; }
  const parser=new PDFParse({ data: fs.readFileSync(file) });
  const t=await parser.getText();
  await parser.destroy();
  const text=t.text||'';
  const folios=[...new Set([...text.matchAll(/\b[A-F0-9]{8}\b/g)].map(m=>m[0]))].sort();
  const preguntas=[...new Set([...text.matchAll(/Pregunta\s+(\d{1,3})/gi)].map(m=>Number(m[1])))] .sort((a,b)=>a-b);
  const qr=[...text.matchAll(/EXAMEN:([A-Z0-9]{8}):P(\d+):TV(\d+)/g)].map(m=>m[0]);
  console.log(JSON.stringify({pages:t.total, textLen:text.length, qrMatches:qr.length, hex8Candidates:folios.length, hex8Sample:folios.slice(0,40), preguntasCount:preguntas.length, preguntasSample:preguntas.slice(0,80)},null,2));
})();
