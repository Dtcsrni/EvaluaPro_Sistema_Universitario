$ErrorActionPreference='Stop'
$root='V:/Software/Generador_Examenes_Universitarios_MERN/sistema-evaluacion-universitaria'
$dataset=Join-Path $root 'omr_samples_tv3'
$manifestPath=Join-Path $dataset 'manifest.json'
$answerKeyPath=Join-Path $dataset 'answer_key.json'
$api='http://127.0.0.1:4000/api'

$loginBody=@{ correo='erick.vega@cuh.mx'; contrasena='{y!E8s1VqWJoH*D/|2' } | ConvertTo-Json
$login=Invoke-RestMethod -Method Post -Uri "$api/autenticacion/ingresar" -ContentType 'application/json' -Body $loginBody
$h=@{ Authorization = 'Bearer ' + $login.token }

$periodos=(Invoke-RestMethod -Method Get -Uri "$api/periodos?activo=true&limite=500" -Headers $h).periodos
$p=$periodos | Where-Object { $_.nombre -like 'Lógica*Programación*Febrero*2026' } | Select-Object -First 1
if(-not $p){ throw 'No se encontro periodo objetivo' }
$periodoId=[string]$p._id

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$answerKey = Get-Content $answerKeyPath -Raw | ConvertFrom-Json
$captures = @($manifest.capturas | Select-Object -First 50)
if($captures.Count -lt 50){ throw "Capturas insuficientes: $($captures.Count)" }

$existingResp = Invoke-RestMethod -Method Get -Uri ("$api/banco-preguntas?periodoId={0}&activo=1&limite=5000" -f $periodoId) -Headers $h
$existing = @()
if($existingResp -and $existingResp.preguntas){ $existing = @($existingResp.preguntas) }
$existingSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach($q in $existing){
  $txt = [string]$q.enunciado
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
  $cap=$captures[$i-1]
  $enunciado = "OMR TV3 - Pregunta $i (imagen $($cap.captureId))"
  if($existingSet.Contains($enunciado)){ $skipped++; continue }
  $imgRel=[string]$cap.imagePath
  $imgAbs=Join-Path $dataset $imgRel
  if(-not (Test-Path $imgAbs)){ Write-Host "WARN imagen no existe: $imgAbs"; $failed++; continue }
  $bytes=[System.IO.File]::ReadAllBytes($imgAbs)
  $b64=[System.Convert]::ToBase64String($bytes)
  $mime=Get-MimeFromExtension $imgAbs
  $imgData="data:$mime;base64,$b64"
  $correct=[string]$answerKey."$i"
  if([string]::IsNullOrWhiteSpace($correct)){ $correct='A' }
  $opts = @(
    @{ texto='Opcion A'; esCorrecta=($correct -eq 'A') },
    @{ texto='Opcion B'; esCorrecta=($correct -eq 'B') },
    @{ texto='Opcion C'; esCorrecta=($correct -eq 'C') },
    @{ texto='Opcion D'; esCorrecta=($correct -eq 'D') },
    @{ texto='Opcion E'; esCorrecta=($correct -eq 'E') }
  )
  $body = @{ periodoId=$periodoId; tema='OMR TV3'; enunciado=$enunciado; imagenUrl=$imgData; opciones=$opts } | ConvertTo-Json -Depth 8
  try {
    [void](Invoke-RestMethod -Method Post -Uri "$api/banco-preguntas" -Headers $h -ContentType 'application/json' -Body $body)
    $created++
  } catch {
    $failed++
    Write-Host ("WARN pregunta $i fallo: " + $_.Exception.Message)
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
  temas=@('OMR TV3')
} | ConvertTo-Json -Depth 8

if($plantilla){
  $plantillaId=[string]$plantilla._id
  [void](Invoke-RestMethod -Method Post -Uri ("$api/examenes/plantillas/{0}" -f $plantillaId) -Headers $h -ContentType 'application/json' -Body $plantillaBody)
} else {
  $createdPlantilla = Invoke-RestMethod -Method Post -Uri "$api/examenes/plantillas" -Headers $h -ContentType 'application/json' -Body $plantillaBody
  $plantillaId=[string]$createdPlantilla.plantilla._id
}

$loteBody = @{ plantillaId=$plantillaId; confirmarMasivo=$true; loteId='OMRTV3FM26' } | ConvertTo-Json
$loteResp = Invoke-RestMethod -Method Post -Uri "$api/examenes/generados/lote" -Headers $h -ContentType 'application/json' -Body $loteBody

$generadosResp = Invoke-RestMethod -Method Get -Uri ("$api/examenes/generados?plantillaId={0}&limite=1000" -f $plantillaId) -Headers $h
$generadosCount = 0; if($generadosResp -and $generadosResp.examenes){ $generadosCount = @($generadosResp.examenes).Count }

Write-Host ('PERIODO_ID=' + $periodoId)
Write-Host ('BANCO_CREADAS=' + $created)
Write-Host ('BANCO_OMITIDAS=' + $skipped)
Write-Host ('BANCO_FALLIDAS=' + $failed)
Write-Host ('PLANTILLA_ID=' + $plantillaId)
Write-Host ('LOTE_ID=' + [string]$loteResp.loteId)
Write-Host ('LOTE_TOTAL_ALUMNOS=' + [string]$loteResp.totalAlumnos)
Write-Host ('LOTE_EXAMENES_RESP=' + [string](@($loteResp.examenesGenerados).Count))
Write-Host ('PLANTILLA_EXAMENES_TOTAL_VERIFICADOS=' + $generadosCount)
if($loteResp.lotePdfUrl){ Write-Host ('LOTE_PDF_URL=' + [string]$loteResp.lotePdfUrl) }
