const fs=require('fs');
const {PDFParse}=require('pdf-parse');

(async()=>{
  const file = process.argv[2];
  const outFile = process.argv[3];
  if(!file || !fs.existsSync(file)){
    fs.writeFileSync(outFile, JSON.stringify({ok:false,error:'PDF_NO_ENCONTRADO',file},null,2));
    process.exit(2);
  }
  const parser = new PDFParse({data:fs.readFileSync(file)});
  const text=((await parser.getText()).text || '');
  const folios=[...new Set((text.match(/\b[A-F0-9]{8}\b/g)||[]))].sort();
  fs.writeFileSync(outFile, JSON.stringify({ok:true,file,textLen:text.length,foliosCount:folios.length,folios},null,2));
  await parser.destroy();
})();
