$ErrorActionPreference='Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
$root = Join-Path $repo 'apps/backend/src/modulos/modulo_analiticas/plantillas'
$src = Join-Path $root 'LIBRO_CALIFICACIONES_PRODUCCION_BASE.xlsx'
$dst = Join-Path $root 'LIBRO_CALIFICACIONES_PRODUCCION_BASE_SANITIZADA.xlsx'
$tmp = Join-Path $env:TEMP ('xlsx_sanitize_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
Copy-Item $src (Join-Path $tmp 'f.zip')
Expand-Archive (Join-Path $tmp 'f.zip') (Join-Path $tmp 'unz') -Force
$unz = Join-Path $tmp 'unz'
$sheet2 = Join-Path $unz 'xl/worksheets/sheet2.xml'
$txt = Get-Content $sheet2 -Raw
$txt = [regex]::Replace($txt, '<tableParts[\s\S]*?</tableParts>', '')
Set-Content $sheet2 $txt -NoNewline

$relsPath = Join-Path $unz 'xl/worksheets/_rels/sheet2.xml.rels'
if (Test-Path $relsPath) {
  [xml]$rels = Get-Content $relsPath
  $toRemove = @()
  foreach ($r in $rels.Relationships.Relationship) {
    if ([string]$r.Type -like '*table' -or [string]$r.Target -like '*tables/table1.xml') { $toRemove += $r }
  }
  foreach ($r in $toRemove) { [void]$rels.Relationships.RemoveChild($r) }
  $rels.Save($relsPath)
}

$ctPath = Join-Path $unz '[Content_Types].xml'
[xml]$ct = Get-Content -LiteralPath $ctPath
$rm = @()
foreach ($o in $ct.Types.Override) {
  if ([string]$o.PartName -eq '/xl/tables/table1.xml') { $rm += $o }
}
foreach ($o in $rm) { [void]$ct.Types.RemoveChild($o) }
$ct.Save($ctPath)

$table = Join-Path $unz 'xl/tables/table1.xml'
if (Test-Path $table) { Remove-Item $table -Force }
$tablesDir = Join-Path $unz 'xl/tables'
if ((Test-Path $tablesDir) -and -not (Get-ChildItem $tablesDir -File)) { Remove-Item $tablesDir -Force }

$outZip = Join-Path $tmp 'out.zip'
if (Test-Path $outZip) { Remove-Item $outZip -Force }
Compress-Archive -Path (Join-Path $unz '*') -DestinationPath $outZip -Force
Copy-Item $outZip $dst -Force
Write-Output "OK $dst"
