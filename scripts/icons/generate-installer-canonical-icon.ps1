# generate-installer-canonical-icon.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [string]$OutputPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $OutputPath) {
  $OutputPath = Join-Path $root 'scripts\icons\installer-canonical.ico'
}

Add-Type -AssemblyName System.Drawing

function Save-IcoFromPngImages {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [System.Collections.Generic.List[byte[]]]$PngImages,
    [Parameter(Mandatory = $true)]
    [int[]]$Sizes
  )

  if ($PngImages.Count -ne $Sizes.Count) {
    throw 'Conteo de PNGs y tamaños no coincide.'
  }

  $headerSize = 6
  $entrySize = 16
  $offset = $headerSize + ($entrySize * $PngImages.Count)
  $fs = New-Object System.IO.FileStream($Path, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  $writer = New-Object System.IO.BinaryWriter($fs)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$PngImages.Count)
    for ($i = 0; $i -lt $PngImages.Count; $i++) {
      $size = [int]$Sizes[$i]
      $png = $PngImages[$i]
      $w = if ($size -ge 256) { 0 } else { [byte]$size }
      $h = if ($size -ge 256) { 0 } else { [byte]$size }
      $writer.Write($w)
      $writer.Write($h)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$png.Length)
      $writer.Write([uint32]$offset)
      $offset += $png.Length
    }
    foreach ($png in $PngImages) {
      $writer.Write($png)
    }
  } finally {
    $writer.Flush()
    $writer.Dispose()
    $fs.Dispose()
  }
}

function New-InstallerBitmap {
  param([int]$Size)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  try {
    $bg = [System.Drawing.ColorTranslator]::FromHtml('#0A3A57')
    $accent = [System.Drawing.ColorTranslator]::FromHtml('#17BEBB')
    $ink = [System.Drawing.ColorTranslator]::FromHtml('#E9F7FF')
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = [Math]::Max(1, [int]($Size * 0.08))
    $rect = New-Object System.Drawing.RectangleF $pad, $pad, ($Size - 2 * $pad), ($Size - 2 * $pad)
    $radius = [Math]::Max(4, [int]($Size * 0.22))
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    try {
      $d = [Math]::Max(1, $radius * 2)
      $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90) | Out-Null
      $path.AddArc($rect.X + $rect.Width - $d, $rect.Y, $d, $d, 270, 90) | Out-Null
      $path.AddArc($rect.X + $rect.Width - $d, $rect.Y + $rect.Height - $d, $d, $d, 0, 90) | Out-Null
      $path.AddArc($rect.X, $rect.Y + $rect.Height - $d, $d, $d, 90, 90) | Out-Null
      $path.CloseFigure() | Out-Null

      $fill = New-Object System.Drawing.SolidBrush $bg
      $border = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, $accent.R, $accent.G, $accent.B), [Math]::Max(1, [int]($Size * 0.04)))
      $glyphPen = New-Object System.Drawing.Pen -ArgumentList @($ink, [Math]::Max(2, [int]($Size * 0.10)))
      $glyphPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $glyphPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      $glyphPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      try {
        $g.FillPath($fill, $path)
        $g.DrawPath($border, $path)
        $cx = $Size * 0.5
        $cy = $Size * 0.5
        $dx = $Size * 0.18
        $dy = $Size * 0.18
        $g.DrawLine($glyphPen, $cx - $dx, $cy - $dy, $cx - $dx, $cy + $dy)
        $g.DrawLine($glyphPen, $cx + $dx, $cy - $dy, $cx + $dx, $cy + $dy)
        $g.DrawLine($glyphPen, $cx - ($dx * 0.45), $cy, $cx + ($dx * 0.45), $cy)
      } finally {
        $glyphPen.Dispose()
        $border.Dispose()
        $fill.Dispose()
      }
    } finally {
      $path.Dispose()
    }
  } finally {
    $g.Dispose()
  }

  return $bmp
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = New-Object 'System.Collections.Generic.List[byte[]]'

foreach ($size in $sizes) {
  $bmp = New-InstallerBitmap -Size $size
  try {
    $ms = New-Object System.IO.MemoryStream
    try {
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      [void]$images.Add($ms.ToArray())
    } finally {
      $ms.Dispose()
    }
  } finally {
    $bmp.Dispose()
  }
}

Save-IcoFromPngImages -Path $OutputPath -PngImages $images -Sizes $sizes
Write-Host "[icons] Icono canónico generado: $OutputPath"
