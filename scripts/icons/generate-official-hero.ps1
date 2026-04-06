param(
  [string]$OutputPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $OutputPath) {
  $OutputPath = Join-Path $root 'logos\evaluapro-official-hero.png'
}

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.RectangleF]$Rect,
    [Parameter(Mandatory = $true)]
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = [Math]::Max(1, $Radius * 2)
  $path.AddArc($Rect.X, $Rect.Y, $diameter, $diameter, 180, 90) | Out-Null
  $path.AddArc($Rect.Right - $diameter, $Rect.Y, $diameter, $diameter, 270, 90) | Out-Null
  $path.AddArc($Rect.Right - $diameter, $Rect.Bottom - $diameter, $diameter, $diameter, 0, 90) | Out-Null
  $path.AddArc($Rect.X, $Rect.Bottom - $diameter, $diameter, $diameter, 90, 90) | Out-Null
  $path.CloseFigure() | Out-Null
  return $path
}

function Draw-RoundedPanel {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Graphics]$Graphics,
    [Parameter(Mandatory = $true)]
    [System.Drawing.RectangleF]$Rect,
    [Parameter(Mandatory = $true)]
    [System.Drawing.Color]$FillColor,
    [Parameter(Mandatory = $true)]
    [System.Drawing.Color]$StrokeColor,
    [float]$Radius = 28,
    [float]$StrokeWidth = 3
  )

  $path = New-RoundedRectanglePath -Rect $Rect -Radius $Radius
  try {
    $fill = New-Object System.Drawing.SolidBrush $FillColor
    $stroke = New-Object System.Drawing.Pen ($StrokeColor, $StrokeWidth)
    try {
      $Graphics.FillPath($fill, $path)
      $Graphics.DrawPath($stroke, $path)
    } finally {
      $fill.Dispose()
      $stroke.Dispose()
    }
  } finally {
    $path.Dispose()
  }
}

function Draw-EvaluaProLogo {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Graphics]$Graphics,
    [float]$Scale = 1.0,
    [float]$OffsetX = 0,
    [float]$OffsetY = 0
  )

  $accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#7FD1C8'))
  $capFill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(48, 245, 239, 221))
  $capStroke = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#D5A73A'), (9 * $Scale))
  $accentPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#7FD1C8'), (10 * $Scale))
  $lightPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#F2EAD5'), (9 * $Scale))
  $inkPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#4D5C72'), (8 * $Scale))
  $softInkPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#7D8AA0'), (8 * $Scale))
  $checkPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#0F8B8D'), (9 * $Scale))

  try {
    $capPoints = [System.Drawing.PointF[]]@(
      (New-Object System.Drawing.PointF ($OffsetX + 240 * $Scale), ($OffsetY + 76 * $Scale)),
      (New-Object System.Drawing.PointF ($OffsetX + 365 * $Scale), ($OffsetY + 128 * $Scale)),
      (New-Object System.Drawing.PointF ($OffsetX + 240 * $Scale), ($OffsetY + 180 * $Scale)),
      (New-Object System.Drawing.PointF ($OffsetX + 115 * $Scale), ($OffsetY + 128 * $Scale))
    )
    $Graphics.FillPolygon($capFill, $capPoints)
    $Graphics.DrawPolygon($capStroke, $capPoints)
    $Graphics.DrawArc($lightPen, ($OffsetX + 165 * $Scale), ($OffsetY + 132 * $Scale), (150 * $Scale), (82 * $Scale), 8, 164)
    $Graphics.DrawLine($accentPen, ($OffsetX + 365 * $Scale), ($OffsetY + 128 * $Scale), ($OffsetX + 365 * $Scale), ($OffsetY + 196 * $Scale))
    $Graphics.FillEllipse($accentBrush, ($OffsetX + 353 * $Scale), ($OffsetY + 192 * $Scale), (24 * $Scale), (24 * $Scale))

    $docRect = New-Object System.Drawing.RectangleF ($OffsetX + 143 * $Scale), ($OffsetY + 222 * $Scale), (190 * $Scale), (126 * $Scale)
    Draw-RoundedPanel `
      -Graphics $Graphics `
      -Rect $docRect `
      -FillColor ([System.Drawing.ColorTranslator]::FromHtml('#F7F4EC')) `
      -StrokeColor ([System.Drawing.Color]::FromArgb(40, 77, 92, 114)) `
      -Radius (24 * $Scale) `
      -StrokeWidth (2 * $Scale)
    $Graphics.DrawLine($inkPen, ($OffsetX + 185 * $Scale), ($OffsetY + 268 * $Scale), ($OffsetX + 263 * $Scale), ($OffsetY + 268 * $Scale))
    $Graphics.DrawLine($softInkPen, ($OffsetX + 185 * $Scale), ($OffsetY + 304 * $Scale), ($OffsetX + 240 * $Scale), ($OffsetY + 304 * $Scale))
    $Graphics.DrawLine($checkPen, ($OffsetX + 277 * $Scale), ($OffsetY + 278 * $Scale), ($OffsetX + 299 * $Scale), ($OffsetY + 300 * $Scale))
    $Graphics.DrawLine($checkPen, ($OffsetX + 299 * $Scale), ($OffsetY + 300 * $Scale), ($OffsetX + 339 * $Scale), ($OffsetY + 258 * $Scale))
  } finally {
    $accentBrush.Dispose()
    $capFill.Dispose()
    $capStroke.Dispose()
    $accentPen.Dispose()
    $lightPen.Dispose()
    $inkPen.Dispose()
    $softInkPen.Dispose()
    $checkPen.Dispose()
  }
}

$width = 720
$height = 720
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)

try {
  Draw-EvaluaProLogo -Graphics $graphics -Scale 1.55 -OffsetX 61 -OffsetY 72

  $targetDir = Split-Path -Parent $OutputPath
  if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "[icons] Hero oficial generado: $OutputPath"
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
