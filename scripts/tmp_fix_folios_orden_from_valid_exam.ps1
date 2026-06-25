# tmp_fix_folios_orden_from_valid_exam.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
$ErrorActionPreference='Stop'
Set-Location 'V:/Software/Generador_Examenes_Universitarios_MERN/sistema-evaluacion-universitaria'

$api='http://127.0.0.1:4000/api'
$plantillaId='69a6f849c2c6e9f7684bdfd8'
$mongoContainer='sistema-evaluacion-universitaria-mongo_local-1'
$mongoUri='mongodb://127.0.0.1:27017/mern_app_prod'

$loginBody=@{ correo='erick.vega@cuh.mx'; contrasena='{y!E8s1VqWJoH*D/|2' } | ConvertTo-Json
$login=Invoke-RestMethod -Method Post -Uri "$api/autenticacion/ingresar" -ContentType 'application/json' -Body $loginBody
$h=@{ Authorization = 'Bearer ' + $login.token }

$imageFolios=@(
  Get-ChildItem -Path './omr_samples_tv3/images/Por Folio' -Directory |
    ForEach-Object { $_.Name } |
    Where-Object { $_ -match '^[A-Fa-f0-9]{8}$' } |
    Sort-Object -Unique
)

$exResp=Invoke-RestMethod -Method Get -Uri ("$api/examenes/generados?plantillaId={0}&limite=500" -f $plantillaId) -Headers $h
$examenes=@($exResp.examenes | Where-Object { -not $_.archivadoEn } | Sort-Object @{Expression={[datetime]$_.generadoEn}}, @{Expression={[string]$_._id}})

if($examenes.Count -ne $imageFolios.Count){ throw "Cantidad distinta: examenes=$($examenes.Count) detectados=$($imageFolios.Count)" }

$assignments=@()
for($i=0; $i -lt $examenes.Count; $i++){
  $assignments += [pscustomobject]@{
    id = [string]$examenes[$i]._id
    folio = [string]$imageFolios[$i]
  }
}

$assignJson = $assignments | ConvertTo-Json -Compress
$mongoScriptTemplate = @'
const plantillaId = '__PLANTILLA__';
const assignments = __ASSIGN__;
const dbx = db.getSiblingDB('mern_app_prod');

const pool = dbx.examenesGenerados.find({ plantillaId: ObjectId(plantillaId), archivadoEn: null }).toArray();
const source = pool.find((e) => Array.isArray(e.preguntasIds) && e.preguntasIds.length === 50 && e.preguntasIds.every((x) => x && ObjectId.isValid(String(x))));
if (!source) {
  printjson({ ok: false, error: 'NO_SOURCE_CANONICO' });
  quit(2);
}

const canonicalObj = source.preguntasIds.map((x) => ObjectId(String(x)));
const canonicalStr = canonicalObj.map((x) => String(x));

let updated = 0;
for (const a of assignments) {
  const r = dbx.examenesGenerados.updateOne(
    { _id: ObjectId(a.id), plantillaId: ObjectId(plantillaId) },
    {
      $set: {
        folio: String(a.folio).toUpperCase(),
        preguntasIds: canonicalObj,
        'mapaVariante.ordenPreguntas': canonicalStr
      }
    }
  );
  if (r && r.matchedCount === 1) updated += 1;
}

printjson({ ok: true, updated, total: assignments.length, canonical: canonicalStr.length, sourceId: String(source._id) });
'@

$mongoScript = $mongoScriptTemplate.Replace('__PLANTILLA__',$plantillaId).Replace('__ASSIGN__',$assignJson)
$mongoScriptPath='./reports/qa/latest/tmp_fix_from_valid_exam.js'
Set-Content -Path $mongoScriptPath -Value $mongoScript -Encoding UTF8
& docker cp $mongoScriptPath "$mongoContainer`:/tmp/tmp_fix_from_valid_exam.js" | Out-Null
& docker exec $mongoContainer mongosh --quiet $mongoUri /tmp/tmp_fix_from_valid_exam.js | Set-Content './reports/qa/latest/tmp_fix_from_valid_exam_result.txt' -Encoding UTF8

$regenOk=0
$regenFail=@()
foreach($a in $assignments){
  $id=[string]$a.id
  $body=@{ forzar=$true } | ConvertTo-Json
  try {
    [void](Invoke-RestMethod -Method Post -Uri ("$api/examenes/generados/{0}/regenerar" -f $id) -Headers $h -ContentType 'application/json' -Body $body)
    $regenOk++
  } catch {
    $regenFail += $id
  }
}

$exAfter=@((Invoke-RestMethod -Method Get -Uri ("$api/examenes/generados?plantillaId={0}&limite=500" -f $plantillaId) -Headers $h).examenes | Where-Object { -not $_.archivadoEn })

$setDetect=[System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$imageFolios | ForEach-Object { [void]$setDetect.Add($_) }
$foliosAfter=@($exAfter | ForEach-Object { [string]$_.folio })
$coinc=@($foliosAfter | Where-Object { $setDetect.Contains($_) })

$validExam=@($exAfter | Where-Object { $_.preguntasIds -and $_.preguntasIds.Count -eq 50 }) | Select-Object -First 1
$canon=@()
if($validExam){ $canon=@($validExam.preguntasIds | ForEach-Object {[string]$_}) }

$ordenOk=0
$qrOk=0
foreach($e in $exAfter){
  $ids=@($e.preguntasIds | ForEach-Object { [string]$_ })
  $same = ($canon.Count -eq 50 -and $ids.Count -eq $canon.Count)
  if($same){
    for($k=0; $k -lt $canon.Count; $k++){
      if([string]$ids[$k] -ne [string]$canon[$k]){ $same=$false; break }
    }
  }
  if($same){ $ordenOk++ }

  $folioE=[string]$e.folio
  $qr=''
  if($e.mapaOmr -and $e.mapaOmr.paginas -and $e.mapaOmr.paginas.Count -gt 0 -and $e.mapaOmr.paginas[0].qr){
    $qr=[string]$e.mapaOmr.paginas[0].qr.texto
  }
  if($qr -and ($qr -match ("EXAMEN:{0}:" -f [regex]::Escape($folioE)))){ $qrOk++ }
}

$report=[ordered]@{
  plantillaId=$plantillaId
  total=$exAfter.Count
  foliosCoincidentes=$coinc.Count
  ordenOk=$ordenOk
  qrOk=$qrOk
  regenerados=$regenOk
  regeneracionFallida=$regenFail.Count
  regeneracionFallidaIds=$regenFail
}

($report | ConvertTo-Json -Depth 6) | Set-Content './reports/qa/latest/reconciliacion_final_estado.json' -Encoding UTF8
Write-Host ($report | ConvertTo-Json -Compress)