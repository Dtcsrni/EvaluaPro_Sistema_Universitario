$ErrorActionPreference='Stop'
$root='V:/Software/Generador_Examenes_Universitarios_MERN/sistema-evaluacion-universitaria'
Set-Location $root
$dataset=Join-Path $root 'omr_samples_tv3'
$answerKeyPath=Join-Path $dataset 'answer_key.json'
$api='http://127.0.0.1:4000/api'

$loginBody=@{ correo='erick.vega@cuh.mx'; contrasena='{y!E8s1VqWJoH*D/|2' } | ConvertTo-Json
$login=Invoke-RestMethod -Method Post -Uri "$api/autenticacion/ingresar" -ContentType 'application/json' -Body $loginBody
$h=@{ Authorization = 'Bearer ' + $login.token }

$periodos=(Invoke-RestMethod -Method Get -Uri "$api/periodos?activo=true&limite=500" -Headers $h).periodos
$p=$periodos | Where-Object { $_.nombre -like 'Lógica*Programación*Febrero*2026' } | Select-Object -First 1
if(-not $p){ throw 'No se encontro periodo objetivo' }
$periodoId=[string]$p._id

$temaNombre = 'OMR TV3'
$temaBody = @{ periodoId=$periodoId; nombre=$temaNombre } | ConvertTo-Json
try {
  [void](Invoke-RestMethod -Method Post -Uri "$api/banco-preguntas/temas" -Headers $h -ContentType 'application/json' -Body $temaBody)
} catch {
  $detalle = ''
  if($_.ErrorDetails -and $_.ErrorDetails.Message){ $detalle = [string]$_.ErrorDetails.Message }
  if($detalle -notmatch 'YA_EXISTE|ya existe|DUPLIC|duplic'){
    throw
  }
}

$answerKey = Get-Content $answerKeyPath -Raw | ConvertFrom-Json
$imageRoot = Join-Path $dataset 'images/Por Folio'
$detectedFolios=@(
  Get-ChildItem -Path $imageRoot -Directory |
    ForEach-Object { $_.Name } |
    Where-Object { $_ -match '^[A-Fa-f0-9]{8}$' } |
    Sort-Object -Unique
)
$expectedExamCount=@($detectedFolios).Count
$imageFiles = Get-ChildItem -Path $imageRoot -Recurse -File |
  Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|webp|gif|bmp)$' } |
  Sort-Object FullName
$captureCount = @($imageFiles).Count
if($captureCount -lt 1){ throw 'No hay imagenes en omr_samples_tv3/images/Por Folio' }
if($expectedExamCount -lt 1){ throw 'No hay folios detectados en omr_samples_tv3/images/Por Folio' }

$existingResp = Invoke-RestMethod -Method Get -Uri ("$api/banco-preguntas?periodoId={0}&activo=1&limite=5000" -f $periodoId) -Headers $h
$existing = @()
if($existingResp -and $existingResp.preguntas){ $existing = @($existingResp.preguntas) }
$existingSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach($q in $existing){
  $txt = ''
  if($q.versiones -and $q.versiones.Count -gt 0){ $txt = [string]$q.versiones[0].enunciado }
  if(-not [string]::IsNullOrWhiteSpace($txt)){ [void]$existingSet.Add($txt.Trim()) }
}

function Get-MimeFromExtension([string]$path){
  $ext=[System.IO.Path]::GetExtension($path).ToLowerInvariant()
  switch($ext){
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.png' { 'image/png' }
    '.webp' { 'image/webp' }
    '.gif' { 'image/gif' }
    '.bmp' { 'image/bmp' }
    default { 'image/jpeg' }
  }
}

$created=0; $skipped=0; $failed=0
for($i=1; $i -le 50; $i++){
  $imgFile=$imageFiles[($i-1) % $captureCount]
  $enunciado = "OMR TV3 - Pregunta $i (imagen $($imgFile.BaseName))"
  if($existingSet.Contains($enunciado)){ $skipped++; continue }
  $imgAbs=[string]$imgFile.FullName
  if(-not (Test-Path $imgAbs)){ Write-Host "WARN imagen no existe: $imgAbs"; $failed++; continue }
  $bytes=[System.IO.File]::ReadAllBytes($imgAbs)
  $b64=[System.Convert]::ToBase64String($bytes)
  $mime=Get-MimeFromExtension $imgAbs
  $imgData="data:$mime;base64,$b64"
  $correct=[string]$answerKey."$i"
  if([string]::IsNullOrWhiteSpace($correct)){ $correct='A' }
  $opts = @(
    @{ texto=("Opcion A - Reactivo $i"); esCorrecta=($correct -eq 'A') },
    @{ texto=("Opcion B - Reactivo $i"); esCorrecta=($correct -eq 'B') },
    @{ texto=("Opcion C - Reactivo $i"); esCorrecta=($correct -eq 'C') },
    @{ texto=("Opcion D - Reactivo $i"); esCorrecta=($correct -eq 'D') },
    @{ texto=("Opcion E - Reactivo $i"); esCorrecta=($correct -eq 'E') }
  )
  $body = @{ periodoId=$periodoId; tema=$temaNombre; enunciado=$enunciado; imagenUrl=$imgData; opciones=$opts } | ConvertTo-Json -Depth 8
  try {
    [void](Invoke-RestMethod -Method Post -Uri "$api/banco-preguntas" -Headers $h -ContentType 'application/json' -Body $body)
    $created++
  } catch {
    $detalle = ''
    if($_.ErrorDetails -and $_.ErrorDetails.Message){ $detalle = [string]$_.ErrorDetails.Message }
    if($detalle -match 'PREGUNTA_DUPLICADA|Ya existe una pregunta con ese enunciado'){
      $skipped++
    } else {
      $failed++
      Write-Host ("WARN pregunta $i fallo: " + $_.Exception.Message + " :: " + $detalle)
    }
  }
}

$plantillasResp = Invoke-RestMethod -Method Get -Uri ("$api/examenes/plantillas?periodoId={0}&limite=500" -f $periodoId) -Headers $h
$plantillas=@(); if($plantillasResp -and $plantillasResp.plantillas){ $plantillas=@($plantillasResp.plantillas) }
$titulo='Examen OMR TV3 - Logica de Programacion Feb-Mar 2026'
$plantilla = $plantillas | Where-Object { ([string]$_.titulo) -eq $titulo -and -not $_.archivadoEn } | Select-Object -First 1
$plantillaBody = @{
  periodoId=$periodoId
  tipo='global'
  titulo=$titulo
  instrucciones='Selecciona solo una opcion por reactivo y llena correctamente la hoja OMR.'
  numeroPaginas=4
  reactivosObjetivo=50
  defaultVersionCount=6
  answerKeyMode='scan_sheet'
  temas=@($temaNombre)
} | ConvertTo-Json -Depth 8

if($plantilla){
  $plantillaId=[string]$plantilla._id
  [void](Invoke-RestMethod -Method Post -Uri ("$api/examenes/plantillas/{0}" -f $plantillaId) -Headers $h -ContentType 'application/json' -Body $plantillaBody)
} else {
  $createdPlantilla = Invoke-RestMethod -Method Post -Uri "$api/examenes/plantillas" -Headers $h -ContentType 'application/json' -Body $plantillaBody
  $plantillaId=[string]$createdPlantilla.plantilla._id
}

$loteId=('OMR' + (Get-Date -Format 'MMddHHmmss'))
$loteResp=$null
try {
  $loteBody = @{ plantillaId=$plantillaId; confirmarMasivo=$true; loteId=$loteId } | ConvertTo-Json
  $loteResp = Invoke-RestMethod -Method Post -Uri "$api/examenes/generados/lote" -Headers $h -ContentType 'application/json' -Body $loteBody
} catch {
  $msg=''
  if($_.ErrorDetails -and $_.ErrorDetails.Message){ $msg=[string]$_.ErrorDetails.Message }
  Write-Host ("WARN lote no generado: " + $_.Exception.Message + " :: " + $msg)
}

$generadosResp = Invoke-RestMethod -Method Get -Uri ("$api/examenes/generados?plantillaId={0}&limite=1000" -f $plantillaId) -Headers $h
$generadosCount = 0; if($generadosResp -and $generadosResp.examenes){ $generadosCount = @($generadosResp.examenes).Count }

Write-Host ('PERIODO_ID=' + $periodoId)
Write-Host ('BANCO_CREADAS=' + $created)
Write-Host ('BANCO_OMITIDAS=' + $skipped)
Write-Host ('BANCO_FALLIDAS=' + $failed)
Write-Host ('FOLIOS_DETECTADOS=' + $expectedExamCount)
Write-Host ('PLANTILLA_ID=' + $plantillaId)
Write-Host ('LOTE_ID=' + [string]($(if($loteResp){$loteResp.loteId}else{$loteId})))
Write-Host ('LOTE_TOTAL_ALUMNOS=' + [string]($(if($loteResp){$loteResp.totalAlumnos}else{0})))
Write-Host ('LOTE_EXAMENES_RESP=' + [string]($(if($loteResp){@($loteResp.examenesGenerados).Count}else{0})))
Write-Host ('PLANTILLA_EXAMENES_TOTAL_VERIFICADOS=' + $generadosCount)
if($loteResp -and $loteResp.lotePdfUrl){ Write-Host ('LOTE_PDF_URL=' + [string]$loteResp.lotePdfUrl) }

$summary=[ordered]@{
  periodoId=$periodoId
  tema=$temaNombre
  plantillaId=$plantillaId
  foliosDetectados=$expectedExamCount
  bancoCreadas=$created
  bancoOmitidas=$skipped
  bancoFallidas=$failed
  loteId=($(if($loteResp){[string]$loteResp.loteId}else{$loteId}))
  examenesPlantillaTotal=$generadosCount
}
New-Item -ItemType Directory -Force -Path './reports/qa/latest' | Out-Null
($summary | ConvertTo-Json -Depth 6) | Set-Content './reports/qa/latest/omr_rebuild_summary.json' -Encoding UTF8
