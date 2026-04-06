param(
  [Parameter(Mandatory = $true)]
  [string]$FlavorId,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class NativeIcon {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool DestroyIcon(IntPtr handle);
}
"@

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$heroPath = Join-Path $repoRoot 'logos\evaluapro-official-hero.png'
if (-not (Test-Path -LiteralPath $heroPath)) {
  throw "No se encontró isotipo oficial: $heroPath"
}

$normalizedFlavorId = if ($null -eq $FlavorId) { '' } else { [string]$FlavorId }
$accent = switch ($normalizedFlavorId.Trim().ToLowerInvariant()) {
  'saas-completo' { [System.Drawing.ColorTranslator]::FromHtml('#5B4EE4') }
  'docente-local' { [System.Drawing.ColorTranslator]::FromHtml('#0891B2') }
  default { [System.Drawing.ColorTranslator]::FromHtml('#0891B2') }
}

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

try {
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $hero = New-Object System.Drawing.Bitmap $heroPath
  try {
    $minX = $hero.Width
    $minY = $hero.Height
    $maxX = -1
    $maxY = -1
    for ($y = 0; $y -lt $hero.Height; $y++) {
      for ($x = 0; $x -lt $hero.Width; $x++) {
        if ($hero.GetPixel($x, $y).A -gt 0) {
          if ($x -lt $minX) { $minX = $x }
          if ($y -lt $minY) { $minY = $y }
          if ($x -gt $maxX) { $maxX = $x }
          if ($y -gt $maxY) { $maxY = $y }
        }
      }
    }

    if ($maxX -ge 0 -and $maxY -ge 0) {
      $srcRect = New-Object System.Drawing.Rectangle $minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1)
      $dstRect = New-Object System.Drawing.Rectangle 18, 18, 196, 196
      $graphics.DrawImage($hero, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    }
  } finally {
    $hero.Dispose()
  }

  $badgeBrush = New-Object System.Drawing.SolidBrush $accent
  $badgePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 255, 255, 255), 5)
  try {
    $graphics.FillEllipse($badgeBrush, 170, 170, 54, 54)
    $graphics.DrawEllipse($badgePen, 170, 170, 54, 54)
  } finally {
    $badgePen.Dispose()
    $badgeBrush.Dispose()
  }

  $hIcon = $bitmap.GetHicon()
  try {
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    try {
      $dir = Split-Path -Parent $OutputPath
      if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
      }
      $fs = [System.IO.File]::Create($OutputPath)
      try {
        $icon.Save($fs)
      } finally {
        $fs.Dispose()
      }
    } finally {
      $icon.Dispose()
    }
  } finally {
    [NativeIcon]::DestroyIcon($hIcon) | Out-Null
  }
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Host "[icons] Icono por flavor generado (Win32-256): $OutputPath ($FlavorId)"
