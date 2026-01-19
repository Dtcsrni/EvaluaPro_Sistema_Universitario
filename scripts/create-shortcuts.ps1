# Creates Windows shortcuts (.lnk) for the dashboard.
param(
  [string]$OutputDir = "accesos-directos",
  [switch]$Force
)

$root = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$target = Join-Path $env:WINDIR "System32\wscript.exe"
$iconDir = Join-Path $root "scripts\icons"
$iconDev = Join-Path $iconDir "dashboard-dev.ico"
$iconProd = Join-Path $iconDir "dashboard-prod.ico"

# Copia local para mejorar compatibilidad de Explorer (especialmente si el repo vive en unidad mapeada/red).
$localIconDir = $null
try {
  if ($env:LOCALAPPDATA) {
    $localIconDir = Join-Path $env:LOCALAPPDATA "EvaluaPro\icons"
    if (-not (Test-Path $localIconDir)) {
      New-Item -ItemType Directory -Path $localIconDir -Force | Out-Null
    }
  }
} catch {
  $localIconDir = $null
}

$outPath = Join-Path $root $OutputDir
if (-not (Test-Path $outPath)) {
  New-Item -ItemType Directory -Path $outPath | Out-Null
}

if ($Force) {
  # Limpia accesos previos para evitar duplicados (incluye "Bandeja" y legacy).
  foreach ($pattern in @('Sistema Evaluacion - *.lnk', 'EvaluaPro - *.lnk', 'Sistema EvaluaPro - *.lnk')) {
    Get-ChildItem -Path $outPath -Filter $pattern -ErrorAction SilentlyContinue | ForEach-Object {
      try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}

if (-not (Test-Path $iconDir)) {
  New-Item -ItemType Directory -Path $iconDir | Out-Null
}

Add-Type -AssemblyName System.Drawing

$csharp = @'
using System;
using System.Runtime.InteropServices;

public static class NativeIcons {
  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool DestroyIcon(IntPtr hIcon);
}
'@

try {
  Add-Type -TypeDefinition $csharp -ErrorAction SilentlyContinue | Out-Null
} catch {
  # ignore
}

function New-RoundedRectPath([System.Drawing.RectangleF]$rect, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [Math]::Max(1.0, $radius * 2.0)
  $x = $rect.X
  $y = $rect.Y
  $w = $rect.Width
  $h = $rect.Height

  $path.AddArc($x, $y, $d, $d, 180, 90) | Out-Null
  $path.AddArc(($x + $w - $d), $y, $d, $d, 270, 90) | Out-Null
  $path.AddArc(($x + $w - $d), ($y + $h - $d), $d, $d, 0, 90) | Out-Null
  $path.AddArc($x, ($y + $h - $d), $d, $d, 90, 90) | Out-Null
  $path.CloseFigure() | Out-Null
  return $path
}

function Save-IcoFromBitmap([string]$path, [System.Drawing.Bitmap]$bitmap) {
  # ICO clásico de una sola imagen via GetHicon + Icon.Save.
  $hIcon = [IntPtr]::Zero
  $ico = $null
  $fs = $null
  try {
    $hIcon = $bitmap.GetHicon()
    $ico = [System.Drawing.Icon]::FromHandle($hIcon)
    $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $ico.Save($fs)
  } finally {
    try { if ($fs) { $fs.Dispose() } } catch {}
    try { if ($ico) { $ico.Dispose() } } catch {}
    try {
      if ($hIcon -ne [IntPtr]::Zero) {
        [NativeIcons]::DestroyIcon($hIcon) | Out-Null
      }
    } catch {
      # ignore
    }
  }
}

function New-ModernDashboardBitmap([int]$size, [string]$label, [string]$bgHexA, [string]$bgHexB, [string]$accentHex) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bgA = [System.Drawing.ColorTranslator]::FromHtml($bgHexA)
  $bgB = [System.Drawing.ColorTranslator]::FromHtml($bgHexB)
  $accent = [System.Drawing.ColorTranslator]::FromHtml($accentHex)
  $ink = [System.Drawing.Color]::FromArgb(238, 255, 255, 255)
  $inkSoft = [System.Drawing.Color]::FromArgb(200, 226, 232, 240)
  $shadow = [System.Drawing.Color]::FromArgb(70, 0, 0, 0)

  $graphics.Clear([System.Drawing.Color]::Transparent)

  $pad = [Math]::Max(2, [int]($size * 0.08))
  $rect = New-Object System.Drawing.RectangleF $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)
  $radius = [Math]::Max(8, [int]($size * 0.24))
  $bgPath = New-RoundedRectPath $rect $radius
  try {
    # Base background
    $brushBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $bgA, $bgB, 45)
    $graphics.FillPath($brushBg, $bgPath)

    # Soft highlight
    $highlight = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      $rect,
      [System.Drawing.Color]::FromArgb(55, 255, 255, 255),
      [System.Drawing.Color]::FromArgb(0, 255, 255, 255),
      120
    )
    $graphics.FillPath($highlight, $bgPath)

    # Outer border
    $penOuter = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(85, 0, 0, 0), [Math]::Max(1, [int]($size * 0.02)))
    $graphics.DrawPath($penOuter, $bgPath)

    # Inner border
    $innerRect = $rect
    $innerRect.Inflate(-[Math]::Max(2, [int]($size * 0.06)), -[Math]::Max(2, [int]($size * 0.06)))
    $innerPath = New-RoundedRectPath $innerRect ([Math]::Max(6, [int]($size * 0.18)))
    $penInner = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80, $accent.R, $accent.G, $accent.B), [Math]::Max(1, [int]($size * 0.012)))
    $graphics.DrawPath($penInner, $innerPath)

    # Central glyph: stacked panels
    $glyphW = [Math]::Max(26, [int]($size * 0.44))
    $glyphH = [Math]::Max(22, [int]($size * 0.30))
    $glyphX = [int](($size - $glyphW) / 2)
    $glyphY = [int]($size * 0.30)
    $offset = [Math]::Max(3, [int]($size * 0.05))
    $corner = [Math]::Max(6, [int]($size * 0.10))

    $backRect = New-Object System.Drawing.RectangleF ($glyphX + $offset), ($glyphY + $offset), $glyphW, $glyphH
    $frontRect = New-Object System.Drawing.RectangleF $glyphX, $glyphY, $glyphW, $glyphH
    $backPath = New-RoundedRectPath $backRect $corner
    $frontPath = New-RoundedRectPath $frontRect $corner

    $backFill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 255, 255, 255))
    $backBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, $accent.R, $accent.G, $accent.B), [Math]::Max(1, [int]($size * 0.012)))
    $graphics.FillPath($backFill, $backPath)
    $graphics.DrawPath($backBorder, $backPath)

    $frontFill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(190, 255, 255, 255))
    $frontBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(170, $accent.R, $accent.G, $accent.B), [Math]::Max(1, [int]($size * 0.016)))
    $graphics.FillPath($frontFill, $frontPath)
    $graphics.DrawPath($frontBorder, $frontPath)

    # Network line + nodes
    $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(235, $accent.R, $accent.G, $accent.B), [Math]::Max(2, [int]($size * 0.03)))
    $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $gx = $frontRect.X
    $gy = $frontRect.Y
    $gw = $frontRect.Width
    $gh = $frontRect.Height

    $p1 = New-Object System.Drawing.PointF ($gx + $gw * 0.22), ($gy + $gh * 0.35)
    $p2 = New-Object System.Drawing.PointF ($gx + $gw * 0.55), ($gy + $gh * 0.35)
    $p3 = New-Object System.Drawing.PointF ($gx + $gw * 0.55), ($gy + $gh * 0.68)
    $p4 = New-Object System.Drawing.PointF ($gx + $gw * 0.78), ($gy + $gh * 0.68)
    $graphics.DrawLine($linePen, $p1, $p2)
    $graphics.DrawLine($linePen, $p2, $p3)
    $graphics.DrawLine($linePen, $p3, $p4)

    $node = [Math]::Max(2, [int]($size * 0.035))
    $nodeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(250, $accent.R, $accent.G, $accent.B))
    foreach ($p in @($p1, $p2, $p3, $p4)) {
      $graphics.FillEllipse($nodeBrush, ($p.X - $node / 2), ($p.Y - $node / 2), $node, $node)
    }

    # Badge (DEV/PROD)
    if ($size -ge 96) {
      $badgeW = [int]($size * 0.40)
      $badgeH = [int]($size * 0.16)
      $badgeX = [int]($pad)
      $badgeY = [int]($size - $pad - $badgeH)

      $badgeRect = New-Object System.Drawing.RectangleF $badgeX, $badgeY, $badgeW, $badgeH
      $badgePath = New-RoundedRectPath $badgeRect ([Math]::Max(6, [int]($badgeH * 0.45)))

      $badgeFill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(140, 0, 0, 0))
      $badgeBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, $accent.R, $accent.G, $accent.B), [Math]::Max(1, [int]($size * 0.012)))
      $graphics.FillPath($badgeFill, $badgePath)
      $graphics.DrawPath($badgeBorder, $badgePath)

      $fontSize = [int]([Math]::Max(11, $size * 0.11))
      $font = New-Object System.Drawing.Font -ArgumentList "Segoe UI", $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
      $format = New-Object System.Drawing.StringFormat
      $format.Alignment = "Center"
      $format.LineAlignment = "Center"
      $textBrush = New-Object System.Drawing.SolidBrush $ink
      $graphics.DrawString($label, $font, $textBrush, $badgeRect, $format)

      $textBrush.Dispose(); $format.Dispose(); $font.Dispose(); $badgeBorder.Dispose(); $badgeFill.Dispose(); $badgePath.Dispose()
    } else {
      $dot = [Math]::Max(3, [int]($size * 0.16))
      $dotRect = New-Object System.Drawing.RectangleF ($size - $pad - $dot), ($pad), $dot, $dot
      $dotShadow = New-Object System.Drawing.SolidBrush $shadow
      $graphics.FillEllipse($dotShadow, ($dotRect.X + 1), ($dotRect.Y + 1), $dotRect.Width, $dotRect.Height)
      $dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, $accent.R, $accent.G, $accent.B))
      $graphics.FillEllipse($dotBrush, $dotRect)
      $dotBrush.Dispose(); $dotShadow.Dispose()
    }

    # Cleanup (local)
    $nodeBrush.Dispose()
    $linePen.Dispose()
    $frontBorder.Dispose()
    $frontFill.Dispose()
    $frontPath.Dispose()
    $backBorder.Dispose()
    $backFill.Dispose()
    $backPath.Dispose()
    $penInner.Dispose()
    $innerPath.Dispose()
    $penOuter.Dispose()
    $highlight.Dispose()
    $brushBg.Dispose()
  } finally {
    $bgPath.Dispose()
    $graphics.Dispose()
  }

  return $bitmap
}
function New-DashboardIcon([string]$path, [string]$label, [string]$bgHexA, [string]$bgHexB, [string]$accentHex) {
  if (-not $Force -and (Test-Path $path)) {
    return
  }

  # Un solo tamaño grande: Explorer escalará para las vistas pequeñas.
  $bmp = New-ModernDashboardBitmap 256 $label $bgHexA $bgHexB $accentHex
  try {
    Save-IcoFromBitmap $path $bmp
  } finally {
    try { $bmp.Dispose() } catch {}
  }
}

# Paleta (oscuro + neón), consistente con los favicons.
New-DashboardIcon $iconDev "DEV" "#0b1020" "#151b2e" "#38bdf8"
New-DashboardIcon $iconProd "PROD" "#0b1020" "#151b2e" "#22c55e"

$iconDevForLnk = $iconDev
$iconProdForLnk = $iconProd
if ($localIconDir) {
  try {
    $localDev = Join-Path $localIconDir "dashboard-dev.ico"
    $localProd = Join-Path $localIconDir "dashboard-prod.ico"
    Copy-Item -LiteralPath $iconDev -Destination $localDev -Force
    Copy-Item -LiteralPath $iconProd -Destination $localProd -Force
    $iconDevForLnk = $localDev
    $iconProdForLnk = $localProd
  } catch {
    # Si falla la copia local, seguimos con los iconos del repo.
    $iconDevForLnk = $iconDev
    $iconProdForLnk = $iconProd
  }
}

$wsh = New-Object -ComObject WScript.Shell

function New-Shortcut([string]$name, [string]$mode, [string]$iconPath) {
  $lnkPath = Join-Path $outPath ($name + ".lnk")
  $shortcut = $wsh.CreateShortcut($lnkPath)
  $shortcut.TargetPath = $target
  # Solo 2 accesos directos: Dev y Prod. Ambos lanzan el ícono en bandeja.
  $shortcut.Arguments = "//nologo `"scripts\launcher-tray-hidden.vbs`" $mode 4519"
  $shortcut.WorkingDirectory = $root
  $shortcut.Description = "Bandeja (tray) $name"
  # Nota: algunos entornos de Explorer muestran icono en blanco si no se especifica índice.
  $shortcut.IconLocation = "$iconPath,0"
  $shortcut.Save()
}

New-Shortcut "EvaluaPro - Dev" "dev" $iconDevForLnk
New-Shortcut "EvaluaPro - Prod" "prod" $iconProdForLnk

Write-Host "Accesos directos creados en: $outPath"
