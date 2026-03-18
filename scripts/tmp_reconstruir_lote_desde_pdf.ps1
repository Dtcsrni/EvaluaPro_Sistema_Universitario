param(
  [Parameter(Mandatory = $true)]
  [string]$PdfPath,
  [string]$PeriodoId = '69a6f63dc2c6e9f7684bdf7d',
  [string]$PlantillaTitulo = 'Examen OMR TV3 - Logica de Programacion Feb-Mar 2026',
  [string]$Tema = 'OMR TV3'
)

$ErrorActionPreference = 'Stop'
Set-Location 'V:/Software/Generador_Examenes_Universitarios_MERN/sistema-evaluacion-universitaria'

$api = 'http://127.0.0.1:4000/api'
$mongoContainer = 'sistema-evaluacion-universitaria-mongo_local-1'
$mongoUri = 'mongodb://127.0.0.1:27017/mern_app_prod'

New-Item -ItemType Directory -Force -Path './reports/qa/latest/pdf_probe' | Out-Null

# 1) Extraer folios del PDF con Node + pdf-parse
$probeDir = './reports/qa/latest/pdf_probe'
Push-Location $probeDir
if (-not (Test-Path './package.json')) { npm init -y | Out-Null }
npm install pdf-parse --silent | Out-Null

$extractJs = @"
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
"@
Set-Content -Path './extract_folios.js' -Value $extractJs -Encoding UTF8

$pdfAbs = ([System.IO.Path]::GetFullPath($PdfPath)).Replace('\\', '/')
$foliosJson = [System.IO.Path]::GetFullPath('./reports/qa/latest/pdf_probe/folios_from_pdf.json')
node './extract_folios.js' $pdfAbs $foliosJson
Pop-Location

if (-not (Test-Path $foliosJson)) {
  throw "No se genero salida de extracción de folios: $foliosJson"
}

$folioPayload = Get-Content $foliosJson -Raw | ConvertFrom-Json
if (-not $folioPayload.ok) { throw "No se pudieron extraer folios del PDF: $($folioPayload.error)" }
$imageFolios = @($folioPayload.folios | ForEach-Object { [string]$_ } | Where-Object { $_ -match '^[A-F0-9]{8}$' } | Sort-Object -Unique)
if ($imageFolios.Count -eq 0) { throw 'No se encontraron folios válidos en el PDF.' }

# 2) Login API
$loginBody = @{ correo = 'erick.vega@cuh.mx'; contrasena = '{y!E8s1VqWJoH*D/|2' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$api/autenticacion/ingresar" -ContentType 'application/json' -Body $loginBody
$h = @{ Authorization = 'Bearer ' + $login.token }

# 3) Resolver plantilla objetivo
$plsResp = Invoke-RestMethod -Method Get -Uri ("$api/examenes/plantillas?periodoId={0}&limite=500" -f $PeriodoId) -Headers $h
$plantillas = @(); if ($plsResp -and $plsResp.plantillas) { $plantillas = @($plsResp.plantillas) }
$plantilla = @($plantillas | Where-Object { ([string]$_.titulo) -eq $PlantillaTitulo -and -not $_.archivadoEn } | Sort-Object @{Expression = { [datetime]$_.updatedAt }} -Descending | Select-Object -First 1)
if (-not $plantilla) { throw "No se encontro plantilla objetivo: $PlantillaTitulo" }
$plantillaId = [string]$plantilla[0]._id

# 4) Canon de preguntas desde banco actual del tema (equivalencia funcional)
$pregResp = Invoke-RestMethod -Method Get -Uri ("$api/banco-preguntas?periodoId={0}&activo=1&limite=5000" -f $PeriodoId) -Headers $h
$preguntasRaw = @()
if ($pregResp) {
  if ($pregResp.PSObject.Properties['preguntas']) { $preguntasRaw = @($pregResp.preguntas) }
  elseif ($pregResp.PSObject.Properties['items']) { $preguntasRaw = @($pregResp.items) }
  elseif ($pregResp.PSObject.Properties['data']) {
    if ($pregResp.data -is [System.Array]) { $preguntasRaw = @($pregResp.data) }
    elseif ($pregResp.data -and $pregResp.data.PSObject.Properties['preguntas']) { $preguntasRaw = @($pregResp.data.preguntas) }
    elseif ($pregResp.data -and $pregResp.data.PSObject.Properties['items']) { $preguntasRaw = @($pregResp.data.items) }
  }
}

$preguntas = @($preguntasRaw | Where-Object {
  $temaVal = [string]$_.tema
  -not [string]::IsNullOrWhiteSpace($temaVal) -and $temaVal.Trim().ToUpperInvariant() -eq $Tema.Trim().ToUpperInvariant()
})
if ($preguntas.Count -lt 50) { throw "Banco insuficiente para tema '$Tema': $($preguntas.Count)" }

$canonRows = @()
foreach ($p in $preguntas) {
  $en = ''
  if ($p.versiones -and $p.versiones.Count -gt 0) { $en = [string]$p.versiones[0].enunciado }

  $num = 9999
  if ($en -match 'Pregunta\s+(\d+)') { $num = [int]$matches[1] }

  $qid = ''
  if ($p.PSObject.Properties['_id']) { $qid = [string]$p.PSObject.Properties['_id'].Value }
  if ([string]::IsNullOrWhiteSpace($qid) -and $p._id -and $p._id.PSObject.Properties['$oid']) { $qid = [string]$p._id.$oid }
  if ([string]::IsNullOrWhiteSpace($qid) -and $p.PSObject.Properties['id']) { $qid = [string]$p.id }
  if ([string]::IsNullOrWhiteSpace($qid)) { $qid = [string]$p._id }
  if ($qid -match '([A-Fa-f0-9]{24})') { $qid = $matches[1] } else { $qid = '' }

  $canonRows += [pscustomobject]@{
    id = $qid
    num = $num
    enunciado = $en
  }
}

$canonIds = @(
  $canonRows |
    Sort-Object @{Expression={[int]$_.num}}, @{Expression={[string]$_.enunciado}} |
    ForEach-Object { [string]$_.id } |
    Where-Object { $_ -match '^[A-Fa-f0-9]{24}$' } |
    Select-Object -First 50
)

$canonDebug = [ordered]@{
  temaObjetivo = $Tema
  preguntasRawCount = $preguntasRaw.Count
  preguntasFiltradasCount = $preguntas.Count
  canonRowsCount = $canonRows.Count
  canonIdsCount = $canonIds.Count
  preguntaSampleKeys = @()
  preguntaSampleTema = ''
  preguntaSampleId = ''
  preguntaSampleIdOid = ''
  preguntaSampleEnunciado = ''
  canonRowsSample = @($canonRows | Select-Object -First 5)
}

if ($preguntasRaw.Count -gt 0) {
  $sampleRaw = $preguntasRaw[0]
  $canonDebug.preguntaSampleKeys = @($sampleRaw.PSObject.Properties.Name)
}
if ($preguntas.Count -gt 0) {
  $sample = $preguntas[0]
  $canonDebug.preguntaSampleTema = [string]$sample.tema
  if ($sample.PSObject.Properties['_id']) { $canonDebug.preguntaSampleId = [string]$sample.PSObject.Properties['_id'].Value }
  if ($sample._id -and $sample._id.PSObject.Properties['$oid']) { $canonDebug.preguntaSampleIdOid = [string]$sample._id.$oid }
  if ($sample.versiones -and $sample.versiones.Count -gt 0) { $canonDebug.preguntaSampleEnunciado = [string]$sample.versiones[0].enunciado }
}

($canonDebug | ConvertTo-Json -Depth 8) | Set-Content './reports/qa/latest/rebuild_pdf_canon_debug.json' -Encoding UTF8

if ($canonIds.Count -ne 50) { throw "No se pudieron resolver 50 IDs canónicos válidos. Obtenidos: $($canonIds.Count). Ver reports/qa/latest/rebuild_pdf_canon_debug.json" }

# 5) Exámenes actuales de la plantilla
$exResp = Invoke-RestMethod -Method Get -Uri ("$api/examenes/generados?plantillaId={0}&limite=1000" -f $plantillaId) -Headers $h
$examenes = @($exResp.examenes | Where-Object { -not $_.archivadoEn } | Sort-Object @{Expression={[datetime]$_.generadoEn}}, @{Expression={[string]$_._id}})
if ($examenes.Count -ne $imageFolios.Count) {
  throw "Cantidad distinta: examenes=$($examenes.Count) foliosPdf=$($imageFolios.Count)."
}

$assignments = @()
for ($i = 0; $i -lt $examenes.Count; $i++) {
  $assignments += [pscustomobject]@{
    examenId = [string]$examenes[$i]._id
    oldFolio = [string]$examenes[$i].folio
    newFolio = [string]$imageFolios[$i]
  }
}

# 6) Aplicar folio + canon en Mongo
$mongoAssignments = @($assignments | ForEach-Object { [pscustomobject]@{ id=[string]$_.examenId; folio=[string]$_.newFolio } })
$idsJson = $canonIds | ConvertTo-Json -Compress
$assignJson = $mongoAssignments | ConvertTo-Json -Compress

$mongoScriptTemplate = @'
const canonical = __IDS__;
const assignments = __ASSIGN__;
const dbx = db.getSiblingDB('mern_app_prod');
let updated = 0;
for (const a of assignments) {
  const result = dbx.examenesGenerados.updateOne(
    { _id: ObjectId(a.id) },
    {
      $set: {
        folio: String(a.folio).toUpperCase(),
        preguntasIds: canonical.map((id) => ObjectId(id)),
        'mapaVariante.ordenPreguntas': canonical
      }
    }
  );
  if (result && result.matchedCount === 1) updated += 1;
}
printjson({ updated, total: assignments.length, canonical: canonical.length });
'@

$mongoScript = $mongoScriptTemplate.Replace('__IDS__', $idsJson).Replace('__ASSIGN__', $assignJson)
$mongoScriptPath = './reports/qa/latest/tmp_rebuild_from_pdf_mongo.js'
Set-Content -Path $mongoScriptPath -Value $mongoScript -Encoding UTF8
& docker cp $mongoScriptPath "$mongoContainer`:/tmp/tmp_rebuild_from_pdf_mongo.js" | Out-Null
& docker exec $mongoContainer mongosh --quiet $mongoUri /tmp/tmp_rebuild_from_pdf_mongo.js | Set-Content './reports/qa/latest/tmp_rebuild_from_pdf_mongo_result.txt' -Encoding UTF8

# 7) Regeneración + validación
$regenOk = 0
$regenFail = @()
foreach ($a in $assignments) {
  $id = [string]$a.examenId
  $body = @{ forzar = $true } | ConvertTo-Json
  try {
    [void](Invoke-RestMethod -Method Post -Uri ("$api/examenes/generados/{0}/regenerar" -f $id) -Headers $h -ContentType 'application/json' -Body $body)
    $regenOk++
  } catch {
    $regenFail += $id
  }
}

$exAfter = @((Invoke-RestMethod -Method Get -Uri ("$api/examenes/generados?plantillaId={0}&limite=1000" -f $plantillaId) -Headers $h).examenes | Where-Object { -not $_.archivadoEn })
$foliosAfter = @($exAfter | ForEach-Object { [string]$_.folio } | Sort-Object -Unique)

$setDetect = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$imageFolios | ForEach-Object { [void]$setDetect.Add($_) }
$coinc = @($foliosAfter | Where-Object { $setDetect.Contains($_) })
$coincideExacto = ($foliosAfter.Count -eq $imageFolios.Count -and $coinc.Count -eq $imageFolios.Count)

$ordenOk = 0
$ordenNoOk = 0
$qrOk = 0
$qrNoOk = 0
foreach ($e in $exAfter) {
  $ids = @($e.preguntasIds | ForEach-Object { [string]$_ })
  $same = $ids.Count -eq $canonIds.Count
  if ($same) {
    for ($k = 0; $k -lt $canonIds.Count; $k++) {
      if ([string]$ids[$k] -ne [string]$canonIds[$k]) { $same = $false; break }
    }
  }
  if ($same) { $ordenOk++ } else { $ordenNoOk++ }

  $folioE = [string]$e.folio
  $qr = ''
  if ($e.mapaOmr -and $e.mapaOmr.paginas -and $e.mapaOmr.paginas.Count -gt 0 -and $e.mapaOmr.paginas[0].qr) {
    $qr = [string]$e.mapaOmr.paginas[0].qr.texto
  }
  if ($qr -and ($qr -match ("EXAMEN:{0}:" -f [regex]::Escape($folioE)))) { $qrOk++ } else { $qrNoOk++ }
}

$report = [ordered]@{
  fuente = 'PDF_LOTE_SIN_BACKUP'
  pdfPath = $pdfAbs
  periodoId = $PeriodoId
  plantillaId = $plantillaId
  loteReferencia = [System.IO.Path]::GetFileNameWithoutExtension($pdfAbs)
  examenesTotal = $exAfter.Count
  foliosPdfTotal = $imageFolios.Count
  foliosCoincidentes = $coinc.Count
  foliosCoincideExacto = $coincideExacto
  ordenCanonOk = $ordenOk
  ordenCanonNoOk = $ordenNoOk
  qrFolioOk = $qrOk
  qrFolioNoOk = $qrNoOk
  regenerados = $regenOk
  regeneracionFallida = $regenFail.Count
  regeneracionFallidaIds = $regenFail
  foliosExtraidos = $imageFolios
}

($assignments | ConvertTo-Json -Depth 6) | Set-Content './reports/qa/latest/rebuild_pdf_folios_asignaciones.json' -Encoding UTF8
($report | ConvertTo-Json -Depth 8) | Set-Content './reports/qa/latest/rebuild_pdf_equivalencia_resultado.json' -Encoding UTF8

Write-Host ($report | ConvertTo-Json -Depth 8)
