# Creates Windows shortcuts (.lnk) for the dashboard.
param(
  [string]$OutputDir = "accesos-directos",
  [switch]$Force
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

function New-DashboardIcon([string]$path, [string]$label, [string]$bgHexA, [string]$bgHexB, [string]$accentHex) {
  if (-not $Force -and (Test-Path $path)) {
    return
  }

  $size = 256
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bgA = [System.Drawing.ColorTranslator]::FromHtml($bgHexA)
  $bgB = [System.Drawing.ColorTranslator]::FromHtml($bgHexB)
  $accent = [System.Drawing.ColorTranslator]::FromHtml($accentHex)
  $white = [System.Drawing.Color]::FromArgb(245, 255, 255, 255)
  $muted = [System.Drawing.Color]::FromArgb(180, 226, 232, 240)

  $graphics.Clear([System.Drawing.Color]::Transparent)

  # Fondo redondeado con gradiente.
  $rect = New-Object System.Drawing.RectangleF 16, 16, ($size - 32), ($size - 32)
  $radius = 64
  $pathRound = New-Object System.Drawing.Drawing2D.GraphicsPath
  $pathRound.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90) | Out-Null
  $pathRound.AddArc($rect.Right - $radius, $rect.Y, $radius, $radius, 270, 90) | Out-Null
  $pathRound.AddArc($rect.Right - $radius, $rect.Bottom - $radius, $radius, $radius, 0, 90) | Out-Null
  $pathRound.AddArc($rect.X, $rect.Bottom - $radius, $radius, $radius, 90, 90) | Out-Null
  $pathRound.CloseFigure() | Out-Null

  $brushBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $bgA, $bgB, 35)
  $graphics.FillPath($brushBg, $pathRound)

  # Sombra suave interna (borde).
  $penSoft = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(40, 15, 23, 42), 6)
  $graphics.DrawPath($penSoft, $pathRound)

  # Tarjeta (simula hoja).
  $card = New-Object System.Drawing.RectangleF 70, 64, 116, 150
  $cardRadius = 22
  $cardPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $cardPath.AddArc($card.X, $card.Y, $cardRadius, $cardRadius, 180, 90) | Out-Null
  $cardPath.AddArc($card.Right - $cardRadius, $card.Y, $cardRadius, $cardRadius, 270, 90) | Out-Null
  $cardPath.AddArc($card.Right - $cardRadius, $card.Bottom - $cardRadius, $cardRadius, $cardRadius, 0, 90) | Out-Null
  $cardPath.AddArc($card.X, $card.Bottom - $cardRadius, $cardRadius, $cardRadius, 90, 90) | Out-Null
  $cardPath.CloseFigure() | Out-Null

  $cardBrush = New-Object System.Drawing.SolidBrush $white
  $graphics.FillPath($cardBrush, $cardPath)
  $cardPen = New-Object System.Drawing.Pen ($muted, 3)
  $graphics.DrawPath($cardPen, $cardPath)

  # Lineas de "contenido".
  $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(170, 148, 163, 184), 6)
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($linePen, 88, 108, 170, 108)
  $graphics.DrawLine($linePen, 88, 132, 160, 132)

  # Marca (check) en acento.
  $checkPen = New-Object System.Drawing.Pen ($accent, 10)
  $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawLines($checkPen, @(
    (New-Object System.Drawing.PointF 92, 168),
    (New-Object System.Drawing.PointF 116, 190),
    (New-Object System.Drawing.PointF 168, 146)
  ))

  # Etiqueta DEV/PROD.
  $font = New-Object System.Drawing.Font -ArgumentList "Segoe UI", 34, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = "Center"
  $format.LineAlignment = "Center"
  $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(230, 255, 255, 255))
  $labelRect = New-Object System.Drawing.RectangleF 0, 202, $size, 52
  $graphics.DrawString($label, $font, $textBrush, $labelRect, $format)

  # Guardar .ico.
  $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
  $stream = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Create)
  $icon.Save($stream)
  $stream.Close()

  # Cleanup.
  $icon.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  $brushBg.Dispose()
  $pathRound.Dispose()
  $penSoft.Dispose()
  $cardBrush.Dispose()
  $cardPen.Dispose()
  $cardPath.Dispose()
  $linePen.Dispose()
  $checkPen.Dispose()
  $font.Dispose()
  $textBrush.Dispose()
  $format.Dispose()
}

New-DashboardIcon $iconDev "DEV" "#0b3a6b" "#2563eb" "#22c55e"
New-DashboardIcon $iconProd "PROD" "#14532d" "#16a34a" "#22c55e"

$wsh = New-Object -ComObject WScript.Shell

function New-Shortcut([string]$name, [string]$mode, [string]$iconPath) {
  $lnkPath = Join-Path $outPath ($name + ".lnk")
  $shortcut = $wsh.CreateShortcut($lnkPath)
  $shortcut.TargetPath = $target
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File `"$root\scripts\launcher-dashboard.ps1`" -Mode $mode -Port 4519"
  $shortcut.WorkingDirectory = $root
  $shortcut.Description = "Dashboard $name"
  $shortcut.IconLocation = $iconPath
  $shortcut.Save()
}

New-Shortcut "Sistema Evaluacion - Dev" "dev" $iconDev
New-Shortcut "Sistema Evaluacion - Prod" "prod" $iconProd

Write-Host "Accesos directos creados en: $outPath"
