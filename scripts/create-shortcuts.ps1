# Creates Windows shortcuts (.lnk) for the dashboard.
param(
  [string]$OutputDir = "accesos-directos"
)

$root = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$target = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
$iconDir = Join-Path $root "scripts\icons"
$iconDev = Join-Path $iconDir "dashboard-dev.ico"
$iconProd = Join-Path $iconDir "dashboard-prod.ico"

$outPath = Join-Path $root $OutputDir
if (-not (Test-Path $outPath)) {
  New-Item -ItemType Directory -Path $outPath | Out-Null
}

if (-not (Test-Path $iconDir)) {
  New-Item -ItemType Directory -Path $iconDir | Out-Null
}

Add-Type -AssemblyName System.Drawing

function New-DashboardIcon([string]$path, [string]$text, [string]$bgHex, [string]$fgHex) {
  if (Test-Path $path) {
    return
  }
  $size = 64
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $bg = [System.Drawing.ColorTranslator]::FromHtml($bgHex)
  $fg = [System.Drawing.ColorTranslator]::FromHtml($fgHex)
  $graphics.Clear($bg)
  $font = New-Object System.Drawing.Font -ArgumentList "Segoe UI", 18, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = "Center"
  $format.LineAlignment = "Center"
  $brush = New-Object System.Drawing.SolidBrush $fg
  $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
  $graphics.DrawString($text, $font, $brush, $rect, $format)
  $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
  $stream = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Create)
  $icon.Save($stream)
  $stream.Close()
  $icon.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  $font.Dispose()
  $brush.Dispose()
  $format.Dispose()
}

New-DashboardIcon $iconDev "DEV" "#0b3a6b" "#ffffff"
New-DashboardIcon $iconProd "PROD" "#1f6b3a" "#ffffff"

$wsh = New-Object -ComObject WScript.Shell

function New-Shortcut([string]$name, [string]$mode, [string]$iconPath) {
  $lnkPath = Join-Path $outPath ($name + ".lnk")
  $shortcut = $wsh.CreateShortcut($lnkPath)
  $shortcut.TargetPath = $target
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File `"$root\scripts\launcher-dashboard.ps1`" -Mode $mode"
  $shortcut.WorkingDirectory = $root
  $shortcut.Description = "Dashboard $name"
  $shortcut.IconLocation = $iconPath
  $shortcut.Save()
}

New-Shortcut "Sistema Evaluacion - Dev" "dev" $iconDev
New-Shortcut "Sistema Evaluacion - Prod" "prod" $iconProd

Write-Host "Accesos directos creados en: $outPath"
