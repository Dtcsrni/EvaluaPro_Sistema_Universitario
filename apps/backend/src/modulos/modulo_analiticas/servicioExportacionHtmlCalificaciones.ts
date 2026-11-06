import type { ListaAcademicaFila } from './tiposListaAcademica.js';
import { createCipheriv, createHmac, randomBytes } from 'node:crypto';

type OpcionesReporteHtml = {
  nombrePeriodo: string;
  cicloLectivo: string;
  filas: ListaAcademicaFila[];
  modo?: 'grupo' | 'individual';
  secretoCiclo?: string;
  generadoEn?: Date;
};

export type CredencialAlumnoReporte = { matricula: string; nombre: string; clave: string };
export type ResultadoHtmlCalificaciones = { html: string; credenciales: CredencialAlumnoReporte[] };

function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function valorHtml(valor: unknown): string {
  return escaparHtml(valor) || '<span class="sin-dato">Sin registro</span>';
}

function textoFecha(fecha: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(fecha);
}

function normalizarClave(valor: string): string {
  return String(valor ?? '').normalize('NFKC').trim().toLocaleUpperCase('es-MX');
}

function derivarClave(secretoCiclo: string, ciclo: string, matricula: string): string {
  return createHmac('sha256', secretoCiclo)
    .update(`EvaluaPro/reporte-calificaciones/v1\0${normalizarClave(ciclo)}\0${normalizarClave(matricula)}`, 'utf8')
    .digest()
    .subarray(0, 16)
    .toString('base64url');
}

function idRegistro(claveBase64Url: string): string {
  return createHmac('sha256', Buffer.from(claveBase64Url, 'base64url'))
    .update('EvaluaPro/consulta-individual/lookup/v1', 'utf8')
    .digest()
    .subarray(0, 16)
    .toString('base64url');
}

function cifrarFila(fila: ListaAcademicaFila, claveBase64Url: string) {
  const key = Buffer.from(claveBase64Url, 'base64url');
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-128-gcm', key, iv);
  const alumno = [fila.nombre, fila.apellidoPaterno, fila.apellidoMaterno].filter(Boolean).join(' ');
  const texto = JSON.stringify({
    matricula: normalizarClave(fila.matricula), alumno, grupo: fila.grupo,
    parcial1: fila.parcial1, parcial2: fila.parcial2, global: fila.global,
    final: fila.calificacionFinalCurso
  });
  const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final(), cifrador.getAuthTag()]);
  return { id: idRegistro(claveBase64Url), iv: iv.toString('base64'), data: cifrado.toString('base64') };
}

export function generarHtmlCalificaciones({ nombrePeriodo, cicloLectivo, filas, modo = 'grupo', secretoCiclo, generadoEn = new Date() }: OpcionesReporteHtml): ResultadoHtmlCalificaciones {
  const columnas: Array<{ etiqueta: string; valor: (fila: ListaAcademicaFila) => string }> = [
    { etiqueta: 'Matrícula', valor: (fila) => fila.matricula },
    { etiqueta: 'Alumno', valor: (fila) => [fila.nombre, fila.apellidoPaterno, fila.apellidoMaterno].filter(Boolean).join(' ') },
    { etiqueta: 'Grupo', valor: (fila) => fila.grupo },
    { etiqueta: 'Parcial 1', valor: (fila) => fila.parcial1 },
    { etiqueta: 'Parcial 2', valor: (fila) => fila.parcial2 },
    { etiqueta: 'Global', valor: (fila) => fila.global },
    { etiqueta: 'Final del curso', valor: (fila) => fila.calificacionFinalCurso }
  ];
  const cuerpo = filas.map((fila) => `<tr>${columnas.map(({ valor }) => `<td>${valorHtml(valor(fila))}</td>`).join('')}</tr>`).join('');
  const camposTarjeta = columnas.filter(({ etiqueta }) => etiqueta !== 'Alumno');
  const tarjetas = filas.map((fila, indice) => {
    const alumno = [fila.nombre, fila.apellidoPaterno, fila.apellidoMaterno].filter(Boolean).join(' ') || 'Nombre no disponible';
    const campos = camposTarjeta.map(({ etiqueta, valor }) => `<div class="grade-card__field"><dt>${escaparHtml(etiqueta)}</dt><dd>${valorHtml(valor(fila))}</dd></div>`).join('');
    return `<article class="grade-card" aria-labelledby="alumno-movil-${indice}"><h2 id="alumno-movil-${indice}">${escaparHtml(alumno)}</h2><dl>${campos}</dl></article>`;
  }).join('');
  const resumenFilas = `${filas.length} ${filas.length === 1 ? 'alumno' : 'alumnos'} · calificaciones registradas`;
  const encabezados = columnas.map(({ etiqueta }) => `<th scope="col">${escaparHtml(etiqueta)}</th>`).join('');
  const credenciales = modo === 'individual' && secretoCiclo
    ? filas.map((fila) => ({
      matricula: fila.matricula,
      nombre: [fila.nombre, fila.apellidoPaterno, fila.apellidoMaterno].filter(Boolean).join(' '),
      clave: derivarClave(secretoCiclo, cicloLectivo || nombrePeriodo, fila.matricula)
    }))
    : [];
  const registrosCifrados = modo === 'individual' && secretoCiclo
    ? filas.map((fila, indice) => cifrarFila(fila, credenciales[indice].clave))
    : [];
  const contenido = modo === 'individual' && secretoCiclo
    ? (() => {
      return `<section aria-labelledby="consulta-titulo">
      <h2 id="consulta-titulo">Consulta individual</h2>
      <p>Ingresa tu matrícula y la clave personal que te compartió tu docente. Si OneDrive bloquea el formulario en su vista previa, descarga el HTML y ábrelo en un navegador compatible.</p>
      <form id="consulta-form">
        <label for="matricula">Matrícula</label><input id="matricula" name="matricula" autocomplete="username" required maxlength="64">
        <label for="clave">Clave personal</label><div class="secret-field"><input id="clave" name="clave" type="password" autocomplete="current-password" required minlength="22" maxlength="22" pattern="[A-Za-z0-9_-]{22}" aria-describedby="clave-ayuda" title="Ingresa los 22 caracteres de tu clave personal."><button id="alternar-visibilidad-clave" class="secret-toggle" type="button" aria-controls="clave">Mostrar clave</button></div>
        <p id="clave-ayuda" class="field-help">Tiene 22 caracteres y distingue mayúsculas de minúsculas. Pégala tal como te la compartió tu docente; puede incluir guion o guion bajo.</p>
        <button type="submit">Consultar calificación</button>
      </form>
      <p class="notice">La clave es individual y permite consultar únicamente el registro ligado a la matrícula correspondiente. No compartas tu clave.</p>
      <p id="estado" role="status" aria-live="polite"></p><section id="resultado" aria-live="polite"></section>
      <script>
        (()=>{
          const records=${JSON.stringify(registrosCifrados)};
          const bytes=(value)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
          const decodeKey=(value)=>bytes(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));
          const encodeUrl=(value)=>btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
          const form=document.getElementById('consulta-form');const status=document.getElementById('estado');const result=document.getElementById('resultado');
          const clave=document.getElementById('clave');const alternarClave=document.getElementById('alternar-visibilidad-clave');
          alternarClave.addEventListener('click',()=>{const visible=clave.type==='text';clave.type=visible?'password':'text';alternarClave.textContent=visible?'Mostrar clave':'Ocultar clave';});
          form.addEventListener('submit',async(event)=>{
            event.preventDefault();status.textContent='Verificando y buscando tu resultado…';result.replaceChildren();
            try{
              const matricula=document.getElementById('matricula').value.normalize('NFKC').trim().toLocaleUpperCase('es-MX');
              const keyBytes=decodeKey(document.getElementById('clave').value.trim());
              const hmacKey=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
              const lookupSignature=new Uint8Array(await crypto.subtle.sign('HMAC',hmacKey,new TextEncoder().encode('EvaluaPro/consulta-individual/lookup/v1')));
              const registroId=encodeUrl(lookupSignature.slice(0,16));
              const record=records.find(item=>item.id===registroId);
              if(!record){status.textContent='No se encontró un resultado con esos datos.';return;}
              const key=await crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['decrypt']);
              const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(record.iv),tagLength:128},key,bytes(record.data));
              const row=JSON.parse(new TextDecoder().decode(plain));
              if(row.matricula!==matricula){status.textContent='No se encontró un resultado con esos datos.';return;}
              const card=document.createElement('article');card.className='grade-card';
              const heading=document.createElement('h2');heading.textContent='Resultado de '+row.alumno;card.append(heading);
              const fields=document.createElement('dl');
              [['Matrícula',row.matricula],['Grupo',row.grupo],['Parcial 1',row.parcial1],['Parcial 2',row.parcial2],['Global',row.global],['Final del curso',row.final]].forEach(([label,value])=>{
                const field=document.createElement('div');field.className='grade-card__field';const term=document.createElement('dt');const detail=document.createElement('dd');term.textContent=label;detail.textContent=value||'Sin registro';field.append(term,detail);fields.append(field);
              });
              card.append(fields);result.append(card);status.textContent='Resultado disponible para esta matrícula.';
            }catch{status.textContent='No se encontró un resultado con esos datos. Verifica matrícula y clave personal.';}
            finally{document.getElementById('clave').value='';}
          });
        })();
      </script>
    </section>`;
    })()
    : `<div class="grades-table-view">
      <p class="table-help" id="tabla-calificaciones-ayuda">La tabla conserva filas y columnas para comparar el grupo. En pantallas estrechas se muestran fichas individuales.</p>
      <div class="table-wrap" role="region" aria-labelledby="tabla-calificaciones-titulo" aria-describedby="tabla-calificaciones-ayuda" tabindex="0">
        <table><caption id="tabla-calificaciones-titulo">${escaparHtml(resumenFilas)}</caption>
          <thead><tr>${encabezados}</tr></thead>
          <tbody>${cuerpo || `<tr><td colspan="${columnas.length}">No hay alumnos registrados para este periodo.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
    <section class="grade-card-view" aria-label="Calificaciones del grupo">
      <p class="grade-cards__summary">${escaparHtml(resumenFilas)}</p>
      <div class="grade-cards">${tarjetas || '<p class="sin-dato">No hay alumnos registrados para este periodo.</p>'}</div>
    </section>`;

  const html = `<!doctype html>
<html lang="es-MX">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Calificaciones · ${escaparHtml(nombrePeriodo)}</title>
  <style>
    :root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#172033;background:#f3f6fb;font-synthesis:none;text-rendering:optimizeLegibility}
    *{box-sizing:border-box}body{margin:0;padding:clamp(1rem,4vw,3rem)}main{max-width:1180px;margin:auto;background:#fff;border:1px solid #d8e0ec;border-radius:1rem;padding:clamp(1rem,3vw,2rem);box-shadow:0 12px 36px #17203312}
    label{display:block;margin-top:1rem;font-weight:650}.field-help{max-width:28rem;margin:.35rem 0 0;color:#46556b;font-size:.9rem;line-height:1.45}input{display:block;width:min(100%,28rem);min-height:2.75rem;padding:.6rem .75rem;border:1px solid #8998ae;border-radius:.4rem;font:inherit}.secret-field{display:flex;flex-wrap:wrap;align-items:stretch;gap:.5rem;max-width:28rem;margin-top:.35rem}.secret-field input{flex:1 1 14rem;width:auto;max-width:28rem;min-width:0}.secret-field button{flex:0 1 auto;margin:0;min-height:2.75rem;padding:.6rem .8rem;border:1px solid #8998ae;background:#fff;color:#205fb1}button{margin-top:1rem;min-height:2.75rem;padding:.6rem 1rem;border:0;border-radius:.4rem;background:#205fb1;color:#fff;font:inherit;font-weight:700;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #005ea8;outline-offset:2px}
    h1{font-size:clamp(1.5rem,4vw,2.25rem);line-height:1.15;margin:.2rem 0 .5rem;color:#14284b}.eyebrow{margin:0;color:#496387;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:.8rem}.meta{color:#46556b;margin:.25rem 0}.notice{margin:1.25rem 0;padding:.85rem 1rem;border-left:4px solid #2871c8;background:#edf5ff;color:#243b5b;border-radius:.25rem}
    .grades-table-view{display:block}.grade-card-view{display:none}.table-help{margin:0 0 .65rem;color:#46556b;font-size:.9rem;line-height:1.45}.table-wrap{overflow-x:auto;border:1px solid #d8e0ec;border-radius:.65rem}.table-wrap:focus-visible{outline:3px solid #005ea8;outline-offset:2px}table{width:100%;border-collapse:collapse;min-width:680px}caption{text-align:left;padding:1rem;font-weight:700;color:#243b5b}th,td{text-align:left;padding:.7rem .8rem;border-bottom:1px solid #e2e8f0;vertical-align:top}th{background:#eef3fa;color:#263c5e;font-size:.88rem}tbody tr:nth-child(even){background:#f8faff}tbody tr:last-child td{border-bottom:0}.sin-dato{color:#68778d;font-style:italic}
    .grade-cards{display:grid;gap:.75rem}.grade-card{border:1px solid #d8e0ec;border-left:4px solid #2871c8;border-radius:.65rem;padding:.9rem;background:#fff;break-inside:avoid}.grade-card h2{margin:0;color:#14284b;font-size:1.05rem;line-height:1.3;overflow-wrap:anywhere}.grade-card dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem 1rem;margin:.75rem 0 0}.grade-card__field{min-width:0}.grade-card dt{color:#496387;font-size:.78rem;font-weight:700}.grade-card dd{margin:.15rem 0 0;color:#172033;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.grade-cards__summary{margin:0 0 .65rem;font-weight:700;color:#243b5b}
    @media(max-width:800px){.grades-table-view{display:none}.grade-card-view{display:block}}
    @media(max-width:600px){body{padding:.5rem}main{border-radius:.5rem;padding:1rem}.notice{font-size:.92rem}}
    @media(max-width:360px){.grade-card dl{grid-template-columns:minmax(0,1fr)}}
    @media print{ :root{background:#fff}body{padding:0}main{max-width:none;border:0;border-radius:0;box-shadow:none;padding:0}.notice{background:#fff;border:1px solid #9aa8ba}.grades-table-view{display:block!important}.grade-card-view{display:none!important}th{background:#eef3fa!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.table-wrap{overflow:visible}table{min-width:0;font-size:9pt}th,td{padding:.35rem}}
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Reporte de calificaciones</p>
      <h1>${escaparHtml(nombrePeriodo)}</h1>
      ${cicloLectivo ? `<p class="meta">Ciclo: ${escaparHtml(cicloLectivo)}</p>` : ''}
      <p class="meta">Generado: <time datetime="${escaparHtml(generadoEn.toISOString())}">${escaparHtml(textoFecha(generadoEn))}</time></p>
    </header>
    <p class="notice">Este archivo contiene calificaciones del grupo y se generó localmente. Su descarga no confirma que los resultados estén publicados en el Portal Alumno. Compártelo desde OneDrive con permiso de lectura y solo con las personas destinatarias.</p>
    ${contenido}
  </main>
</body>
</html>`;
  return { html, credenciales };
}
