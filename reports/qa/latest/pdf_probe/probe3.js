const fs=require('fs');
const {PDFParse}=require('pdf-parse');
(async()=>{
  const file='o:/Descargas/evaluapro_paquete_examenes_materia-Logica_de_Programacion_plantilla-Primer_Parcial_total-15_lote-A050929D.pdf';
  const p=new PDFParse({data:fs.readFileSync(file)});
  const t=((await p.getText()).text||'');
  const hex=[...new Set((t.match(/\b[A-F0-9]{8}\b/g)||[]))].sort();
  const folioCtx=(t.match(/.{0,30}(FOLIO|EXAMEN).{0,60}/gi)||[]).slice(0,30);
  const words=t.split(/\s+/).filter(Boolean);
  console.log(JSON.stringify({textLen:t.length,wordCount:words.length,hexCount:hex.length,hexSample:hex.slice(0,60),folioCtx},null,2));
  await p.destroy();
})();
