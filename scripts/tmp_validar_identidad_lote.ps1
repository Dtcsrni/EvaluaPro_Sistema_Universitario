# tmp_validar_identidad_lote.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [Parameter(Mandatory = $true)]
  [string]$LoteId,
  [switch]$Regenerar
)

$ErrorActionPreference = 'Stop'

Set-Location 'V:/Software/Generador_Examenes_Universitarios_MERN/sistema-evaluacion-universitaria'

$api = 'http://127.0.0.1:4000/api'
$mongoContainer = 'sistema-evaluacion-universitaria-mongo_local-1'
$mongoUri = 'mongodb://127.0.0.1:27017/mern_app_prod'

function To-CanonJson([object]$obj) {
  return ($obj | ConvertTo-Json -Depth 20 -Compress)
}

function Normalize-IdValue([object]$value) {
  if ($null -eq $value) { return '' }
  if ($value -is [string]) { return ([string]$value).Trim() }
  $propOid = $value.PSObject.Properties['$oid']
  if ($propOid -and $propOid.Value) { return ([string]$propOid.Value).Trim() }
  return ([string]$value).Trim()
}

function Normalize-IdArray([object[]]$arr) {
  if ($null -eq $arr) { return @() }
  return @($arr | ForEach-Object { Normalize-IdValue $_ })
}

$tmpJson = './reports/qa/latest/tmp_lote_docs.json'
New-Item -ItemType Directory -Force -Path './reports/qa/latest' | Out-Null

$js = @"
const lote = '$LoteId';
const dbx = db.getSiblingDB('mern_app_prod');
const docs = dbx.examenesGenerados.find({ loteId: lote }).toArray();
print(EJSON.stringify(docs));
"@

$tmpJs = './reports/qa/latest/tmp_lote_query.js'
Set-Content -Path $tmpJs -Value $js -Encoding UTF8
& docker cp $tmpJs "$mongoContainer`:/tmp/tmp_lote_query.js" | Out-Null
& docker exec $mongoContainer mongosh --quiet $mongoUri /tmp/tmp_lote_query.js | Set-Content $tmpJson -Encoding UTF8

$raw = Get-Content $tmpJson -Raw
$docs = @()
if (-not [string]::IsNullOrWhiteSpace($raw)) {
  try { $docs = @($raw | ConvertFrom-Json) } catch { $docs = @() }
}

if ($docs.Count -eq 0) {
  $notFound = [ordered]@{
    loteId = $LoteId
    encontrado = $false
    mensaje = 'No existe en la base activa. Se requiere backup/import de ese lote para validar identidad.'
  }
  ($notFound | ConvertTo-Json -Depth 8) | Set-Content './reports/qa/latest/validacion_identidad_lote.json' -Encoding UTF8
  Write-Host ($notFound | ConvertTo-Json -Depth 8)
  exit 2
}

$periodos = @($docs | ForEach-Object { Normalize-IdValue $_.periodoId } | Sort-Object -Unique)
$plantillas = @($docs | ForEach-Object { Normalize-IdValue $_.plantillaId } | Sort-Object -Unique)

$integridad = @($docs | ForEach-Object {
  $pregIds = Normalize-IdArray @($_.preguntasIds)
  $orden = Normalize-IdArray @($_.mapaVariante.ordenPreguntas)
  [pscustomobject]@{
    examenId = Normalize-IdValue $_._id
    folio = [string]$_.folio
    tieneFolio = -not [string]::IsNullOrWhiteSpace([string]$_.folio)
    preguntasIdsCount = $pregIds.Count
    ordenPreguntasCount = $orden.Count
    idsVsOrdenIguales = ((To-CanonJson $pregIds) -eq (To-CanonJson $orden))
    estado = [string]$_.estado
  }
})

$antesFirma = @{}
foreach ($d in $docs) {
  $idKey = Normalize-IdValue $d._id
  $antesFirma[$idKey] = To-CanonJson([ordered]@{
      folio = [string]$d.folio
      preguntasIds = Normalize-IdArray @($d.preguntasIds)
      mapaVariante = $d.mapaVariante
    })
}

$regen = [ordered]@{
  solicitado = [bool]$Regenerar
  ok = 0
  fail = 0
  failIds = @()
  equivalenciaFuncionalOk = $null
}

if ($Regenerar) {
  $loginBody = @{ correo = 'erick.vega@cuh.mx'; contrasena = '{y!E8s1VqWJoH*D/|2' } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri "$api/autenticacion/ingresar" -ContentType 'application/json' -Body $loginBody
  $h = @{ Authorization = 'Bearer ' + $login.token }

  foreach ($d in $docs) {
    $id = Normalize-IdValue $d._id
    try {
      $body = @{ forzar = $true } | ConvertTo-Json
      [void](Invoke-RestMethod -Method Post -Uri ("$api/examenes/generados/{0}/regenerar" -f $id) -Headers $h -ContentType 'application/json' -Body $body)
      $regen.ok++
    }
    catch {
      $regen.fail++
      $regen.failIds += $id
    }
  }

  $jsPost = @"
const lote = '$LoteId';
const dbx = db.getSiblingDB('mern_app_prod');
const docs = dbx.examenesGenerados.find({ loteId: lote }).toArray();
print(EJSON.stringify(docs));
"@
  $tmpPostJs = './reports/qa/latest/tmp_lote_post_query.js'
  $tmpPostJson = './reports/qa/latest/tmp_lote_docs_post.json'
  Set-Content -Path $tmpPostJs -Value $jsPost -Encoding UTF8
  & docker cp $tmpPostJs "$mongoContainer`:/tmp/tmp_lote_post_query.js" | Out-Null
  & docker exec $mongoContainer mongosh --quiet $mongoUri /tmp/tmp_lote_post_query.js | Set-Content $tmpPostJson -Encoding UTF8

  $postRaw = Get-Content $tmpPostJson -Raw
  $postDocs = @()
  if (-not [string]::IsNullOrWhiteSpace($postRaw)) {
    try { $postDocs = @($postRaw | ConvertFrom-Json) } catch { $postDocs = @() }
  }

  $iguales = 0
  foreach ($p in $postDocs) {
    $id = Normalize-IdValue $p._id
    $firmaPost = To-CanonJson([ordered]@{
        folio = [string]$p.folio
      preguntasIds = Normalize-IdArray @($p.preguntasIds)
        mapaVariante = $p.mapaVariante
      })
    if ($antesFirma.ContainsKey($id) -and $antesFirma[$id] -eq $firmaPost) {
      $iguales++
    }
  }
  $regen.equivalenciaFuncionalOk = ($postDocs.Count -gt 0 -and $iguales -eq $postDocs.Count -and $regen.fail -eq 0)
}

$resultado = [ordered]@{
  loteId = $LoteId
  encontrado = $true
  total = $docs.Count
  periodos = $periodos
  plantillas = $plantillas
  integridad = [ordered]@{
    conFolio = @($integridad | Where-Object { $_.tieneFolio }).Count
    conPreguntasIds = @($integridad | Where-Object { $_.preguntasIdsCount -gt 0 }).Count
    conOrdenPreguntas = @($integridad | Where-Object { $_.ordenPreguntasCount -gt 0 }).Count
    idsVsOrdenIguales = @($integridad | Where-Object { $_.idsVsOrdenIguales }).Count
  }
  regeneracion = $regen
  detalleMuestra = @($integridad | Select-Object -First 5)
}

($resultado | ConvertTo-Json -Depth 10) | Set-Content './reports/qa/latest/validacion_identidad_lote.json' -Encoding UTF8
Write-Host ($resultado | ConvertTo-Json -Depth 10)
