$ErrorActionPreference='Stop'
Set-Location 'V:/Software/Generador_Examenes_Universitarios_MERN/sistema-evaluacion-universitaria'

$api='http://127.0.0.1:4000/api'
$plantillaTitulo='Examen OMR TV3 - Logica de Programacion Feb-Mar 2026'
$mongoContainer='sistema-evaluacion-universitaria-mongo_local-1'
$mongoUri='mongodb://127.0.0.1:27017/mern_app_prod'

$loginBody=@{ correo='erick.vega@cuh.mx'; contrasena='{y!E8s1VqWJoH*D/|2' } | ConvertTo-Json
$login=Invoke-RestMethod -Method Post -Uri "$api/autenticacion/ingresar" -ContentType 'application/json' -Body $loginBody
$h=@{ Authorization = 'Bearer ' + $login.token }

$periodoId='69a6f63dc2c6e9f7684bdf7d'
$plsResp=Invoke-RestMethod -Method Get -Uri ("$api/examenes/plantillas?periodoId={0}&limite=500" -f $periodoId) -Headers $h
$plantillas=@(); if($plsResp -and $plsResp.plantillas){ $plantillas=@($plsResp.plantillas) }
$plantilla=@($plantillas | Where-Object { ([string]$_.titulo) -eq $plantillaTitulo -and -not $_.archivadoEn } | Sort-Object @{Expression={[datetime]$_.updatedAt}} -Descending | Select-Object -First 1)
if(-not $plantilla){ throw "No se encontro plantilla objetivo: $plantillaTitulo" }
$plantillaId=[string]$plantilla[0]._id

$pregResp=Invoke-RestMethod -Method Get -Uri ("$api/banco-preguntas?periodoId={0}&activo=1&limite=5000" -f $periodoId) -Headers $h
$preguntas=@($pregResp.preguntas | Where-Object { $_.tema -eq 'OMR TV3' })
if($preguntas.Count -lt 50){ throw "Banco OMR TV3 insuficiente: $($preguntas.Count)" }

$canonRows=@(
  $preguntas |
    Sort-Object 
      @{Expression={ 
        $en = ''
        if($_.versiones -and $_.versiones.Count -gt 0){ $en = [string]$_.versiones[0].enunciado }
        if($en -match 'Pregunta\s+(\d+)'){ [int]$matches[1] } else { 9999 }
      }},
      @{Expression={ 
        if($_.versiones -and $_.versiones.Count -gt 0){ [string]$_.versiones[0].enunciado } else { '' }
      }} |
    ForEach-Object {
      $en = ''
      if($_.versiones -and $_.versiones.Count -gt 0){ $en = [string]$_.versiones[0].enunciado }
      $num = 9999
      if($en -match 'Pregunta\s+(\d+)'){ $num = [int]$matches[1] }
      $qid=''
      if($_.PSObject.Properties['_id']){ $qid=[string]$_.PSObject.Properties['_id'].Value }
      if([string]::IsNullOrWhiteSpace($qid)){ $qid=[string]($_._id) }
      [pscustomobject]@{ id=$qid; num=$num; enunciado=$en }
    }
)

$canonIds=@(
  $canonRows |
    Sort-Object @{Expression={[int]$_.num}}, @{Expression={[string]$_.enunciado}} |
    ForEach-Object { [string]$_.id } |
    Where-Object { $_ -match '^[A-Fa-f0-9]{24}$' } |
    Select-Object -First 50
)
if($canonIds.Count -ne 50){ throw "No se pudieron resolver 50 IDs canónicos ordenados válidos. Obtenidos: $($canonIds.Count)" }

$imageFolios=@(
  Get-ChildItem -Path './omr_samples_tv3/images/Por Folio' -Directory |
    ForEach-Object { $_.Name } |
    Where-Object { $_ -match '^[A-Fa-f0-9]{8}$' } |
    Sort-Object -Unique
)

$exResp=Invoke-RestMethod -Method Get -Uri ("$api/examenes/generados?plantillaId={0}&limite=500" -f $plantillaId) -Headers $h
$examenes=@($exResp.examenes | Where-Object { -not $_.archivadoEn } | Sort-Object @{Expression={[datetime]$_.generadoEn}}, @{Expression={[string]$_._id}})

if($examenes.Count -ne $imageFolios.Count){
  throw "Cantidad distinta: examenes=$($examenes.Count) detectados=$($imageFolios.Count)"
}

# Detecta colisiones de folio fuera del set objetivo
$allExResp=Invoke-RestMethod -Method Get -Uri "$api/examenes/generados?limite=5000" -Headers $h
$allEx=@($allExResp.examenes | Where-Object { -not $_.archivadoEn })
$targetIds=[System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$examenes | ForEach-Object { [void]$targetIds.Add([string]$_."_id") }
foreach($f in $imageFolios){
  $hits=@($allEx | Where-Object { ([string]$_.folio).ToUpper() -eq $f.ToUpper() })
  foreach($hit in $hits){
    $hid=[string]$hit."_id"
    if(-not $targetIds.Contains($hid)){
      throw "Folio en uso por otro examen: $f (examenId=$hid)"
    }
  }
}

$assignments=@()
for($i=0; $i -lt $examenes.Count; $i++){
  $assignments += [pscustomobject]@{
    examenId = [string]$examenes[$i]."_id"
    oldFolio = [string]$examenes[$i].folio
    newFolio = [string]$imageFolios[$i]
  }
}

$mongoAssignments=@($assignments | ForEach-Object {
  [pscustomobject]@{ id=[string]$_.examenId; folio=[string]$_.newFolio }
})
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
$mongoScript = $mongoScriptTemplate.Replace('__IDS__',$idsJson).Replace('__ASSIGN__',$assignJson)
$mongoScriptPath='./reports/qa/latest/tmp_reconcile_mongo.js'
Set-Content -Path $mongoScriptPath -Value $mongoScript -Encoding UTF8
& docker cp $mongoScriptPath "$mongoContainer`:/tmp/tmp_reconcile_mongo.js" | Out-Null
& docker exec $mongoContainer mongosh --quiet $mongoUri /tmp/tmp_reconcile_mongo.js | Set-Content './reports/qa/latest/tmp_reconcile_mongo_result.txt' -Encoding UTF8

$regenOk=0
$regenFail=@()
foreach($a in $assignments){
  $id=[string]$a.examenId
  $body=@{ forzar=$true } | ConvertTo-Json
  try {
    [void](Invoke-RestMethod -Method Post -Uri ("$api/examenes/generados/{0}/regenerar" -f $id) -Headers $h -ContentType 'application/json' -Body $body)
    $regenOk++
  } catch {
    $regenFail += $id
  }
}

$exAfter=@((Invoke-RestMethod -Method Get -Uri ("$api/examenes/generados?plantillaId={0}&limite=500" -f $plantillaId) -Headers $h).examenes | Where-Object { -not $_.archivadoEn })
$foliosAfter=@($exAfter | ForEach-Object { [string]$_.folio } | Sort-Object -Unique)

$setDetect=[System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$imageFolios | ForEach-Object { [void]$setDetect.Add($_) }
$coinc=@($foliosAfter | Where-Object { $setDetect.Contains($_) })
$coincideExacto=($foliosAfter.Count -eq $imageFolios.Count -and $coinc.Count -eq $imageFolios.Count)

$ordenOk=0
$ordenNoOk=0
$qrOk=0
$qrNoOk=0
foreach($e in $exAfter){
  $ids=@($e.preguntasIds | ForEach-Object { [string]$_ })
  $same = $ids.Count -eq $canonIds.Count
  if($same){
    for($k=0; $k -lt $canonIds.Count; $k++){
      if([string]$ids[$k] -ne [string]$canonIds[$k]){ $same=$false; break }
    }
  }
  if($same){ $ordenOk++ } else { $ordenNoOk++ }

  $folioE=[string]$e.folio
  $qr=''
  if($e.mapaOmr -and $e.mapaOmr.paginas -and $e.mapaOmr.paginas.Count -gt 0 -and $e.mapaOmr.paginas[0].qr){
    $qr=[string]$e.mapaOmr.paginas[0].qr.texto
  }
  if($qr -and ($qr -match ("EXAMEN:{0}:" -f [regex]::Escape($folioE)))){ $qrOk++ } else { $qrNoOk++ }
}

$report=[ordered]@{
  periodoId=$periodoId
  plantillaId=$plantillaId
  examenesTotal=$exAfter.Count
  foliosDetectadosTotal=$imageFolios.Count
  foliosCoincidentes=$coinc.Count
  foliosCoincideExacto=$coincideExacto
  ordenCanonOk=$ordenOk
  ordenCanonNoOk=$ordenNoOk
  qrFolioOk=$qrOk
  qrFolioNoOk=$qrNoOk
  regenerados=$regenOk
  regeneracionFallida=$regenFail.Count
  regeneracionFallidaIds=$regenFail
  loteId=(@($exAfter | Select-Object -First 1 | ForEach-Object { [string]$_.loteId }) | Select-Object -First 1)
}

New-Item -ItemType Directory -Force -Path './reports/qa/latest' | Out-Null
($assignments | ConvertTo-Json -Depth 6) | Set-Content './reports/qa/latest/reconciliacion_folios_asignaciones.json' -Encoding UTF8
($report | ConvertTo-Json -Depth 6) | Set-Content './reports/qa/latest/reconciliacion_folios_orden_resultado.json' -Encoding UTF8
Write-Host 'RECONCILIACION_OK'
