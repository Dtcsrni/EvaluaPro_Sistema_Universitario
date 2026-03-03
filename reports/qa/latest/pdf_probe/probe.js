const fs=require('fs');
const pdf=require('pdf-parse');
const file=String.raw`o:\\Descargas\\evaluapro_paquete_examenes_materia-Logica_de_Programacion_plantilla-Primer_Parcial_total-15_lote-A050929D.pdf`;
if(!fs.existsSync(file)){ console.log('NO_PDF'); process.exit(0); }
const data=fs.readFileSync(file);
pdf(data).then(out=>{
  const text=out.text||'';
  const matches=[...text.matchAll(/EXAMEN:([A-Z0-9]{8}):P(\d+):TV(\d+)/g)].map(m=>m[0]);
  const folios=[...new Set(matches.map(m=>m.split(':')[1]))].sort();
  const qnums=[...text.matchAll(/Pregunta\s+(\d{1,3})/gi)].map(m=>Number(m[1]));
  const uq=[...new Set(qnums)].sort((a,b)=>a-b);
  console.log(JSON.stringify({pages:out.numpages, qrMatches:matches.length, foliosCount:folios.length, foliosSample:folios.slice(0,20), preguntaNumsCount:uq.length, preguntaNumsSample:uq.slice(0,60)},null,2));
}).catch(e=>{ console.log('PARSE_ERR', String(e)); process.exit(1); });
