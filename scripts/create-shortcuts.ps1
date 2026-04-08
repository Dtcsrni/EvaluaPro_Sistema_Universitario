# Creates Windows shortcuts (.lnk) for EvaluaPro.
param(
  [string]$OutputDir = "accesos-directos",
  [bool]$SyncRepoOutput = $false,
  [bool]$SyncDesktop = $true,
  [bool]$SyncStartMenu = $true,
  [bool]$IncludeOpsShortcuts = $true,
  [ValidateRange(1, 65535)]
  [int]$Port = 4519,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$targetWscript = Join-Path $env:WINDIR "System32\wscript.exe"
if (-not (Test-Path -LiteralPath $targetWscript)) {
  $targetWscript = 'wscript.exe'
}
$iconDir = Join-Path $root "scripts\icons"
$outputPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) { $OutputDir } else { Join-Path $root $OutputDir }
$trayHiddenVbs = Join-Path $root 'scripts\launcher-tray-hidden.vbs'
$shortcutOpHiddenVbs = Join-Path $root 'scripts\shortcut-op-hidden.vbs'
foreach ($requiredFile in @($trayHiddenVbs, $shortcutOpHiddenVbs)) {
  if (-not (Test-Path -LiteralPath $requiredFile)) {
    throw "No se encontró archivo requerido para accesos directos: $requiredFile"
  }
}

$desktopPathCandidates = New-Object System.Collections.Generic.List[string]
$overrideDesktopPath = [string]$env:EVALUAPRO_DESKTOP_PATH
if ($overrideDesktopPath) {
  $desktopPathCandidates.Add($overrideDesktopPath)
} else {
  $desktopPath = [Environment]::GetFolderPath('Desktop')
  if ($desktopPath) { $desktopPathCandidates.Add($desktopPath) }
  if ($env:USERPROFILE) {
    $userDesktop = Join-Path $env:USERPROFILE "Desktop"
    if (-not $desktopPathCandidates.Contains($userDesktop)) { $desktopPathCandidates.Add($userDesktop) }
  }
  if ($env:OneDrive) {
    $oneDriveDesktop = Join-Path $env:OneDrive "Desktop"
    if (-not $desktopPathCandidates.Contains($oneDriveDesktop)) { $desktopPathCandidates.Add($oneDriveDesktop) }
  }
}
$startMenuBase = if ($env:APPDATA) { Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs" } else { $null }
$startMenuOverride = [string]$env:EVALUAPRO_STARTMENU_PATH
$startMenuPath = if ($startMenuOverride) { $startMenuOverride } elseif ($startMenuBase) { Join-Path $startMenuBase "EvaluaPro" } else { $null }

$localIconDir = $null
try {
  if ($env:LOCALAPPDATA) {
    $localIconDir = Join-Path $env:LOCALAPPDATA "EvaluaPro\icons"
    New-Item -ItemType Directory -Path $localIconDir -Force | Out-Null
  }
} catch {
  $localIconDir = $null
}

foreach ($dir in @($iconDir, $(if ($SyncRepoOutput) { $outputPath } else { $null }))) {
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
}
if ($SyncStartMenu -and $startMenuPath) {
  New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
}

Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath([System.Drawing.RectangleF]$rect, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [Math]::Max(1.0, $radius * 2.0)
  $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90) | Out-Null
  $path.AddArc($rect.X + $rect.Width - $d, $rect.Y, $d, $d, 270, 90) | Out-Null
  $path.AddArc($rect.X + $rect.Width - $d, $rect.Y + $rect.Height - $d, $d, $d, 0, 90) | Out-Null
  $path.AddArc($rect.X, $rect.Y + $rect.Height - $d, $d, $d, 90, 90) | Out-Null
  $path.CloseFigure() | Out-Null
  return $path
}

function Save-IcoFromPngImages([string]$path, [System.Collections.Generic.List[byte[]]]$pngImages, [int[]]$sizes) {
  if ($pngImages.Count -ne $sizes.Count) {
    throw "Save-IcoFromPngImages: conteos no coinciden"
  }
  $headerSize = 6
  $dirEntrySize = 16
  $offset = $headerSize + ($dirEntrySize * $pngImages.Count)
  $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  $bw = New-Object System.IO.BinaryWriter($fs)
  try {
    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$pngImages.Count)
    for ($i = 0; $i -lt $pngImages.Count; $i++) {
      $size = [int]$sizes[$i]
      $png = $pngImages[$i]
      $w = if ($size -ge 256) { 0 } else { [byte]$size }
      $h = if ($size -ge 256) { 0 } else { [byte]$size }
      $bw.Write($w)
      $bw.Write($h)
      $bw.Write([byte]0)
      $bw.Write([byte]0)
      $bw.Write([uint16]1)
      $bw.Write([uint16]32)
      $bw.Write([uint32]$png.Length)
      $bw.Write([uint32]$offset)
      $offset += $png.Length
    }
    foreach ($png in $pngImages) {
      $bw.Write($png)
    }
  } finally {
    $bw.Flush()
    $bw.Dispose()
    $fs.Dispose()
  }
}

function Draw-Glyph([System.Drawing.Graphics]$g, [string]$kind, [int]$size, [System.Drawing.Color]$accent) {
  $cx = $size * 0.5
  $cy = $size * 0.5
  $thick = [Math]::Max(2, [int]($size * 0.09))
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(240, $accent.R, $accent.G, $accent.B), $thick)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, $accent.R, $accent.G, $accent.B))
  try {
    switch ($kind) {
      'dev' { 
        $dx = $size * 0.18; $dy = $size * 0.12
        $p1 = New-Object System.Drawing.PointF ($cx - $dx), ($cy - $dy)
        $p2 = New-Object System.Drawing.PointF ($cx), ($cy - $dy)
        $p3 = New-Object System.Drawing.PointF ($cx), ($cy + $dy)
        $p4 = New-Object System.Drawing.PointF ($cx + $dx), ($cy + $dy)
        $g.DrawLine($pen, $p1, $p2); $g.DrawLine($pen, $p2, $p3); $g.DrawLine($pen, $p3, $p4)
        $r = [Math]::Max(3, [int]($size * 0.09))
        foreach ($p in @($p1, $p2, $p3, $p4)) { $g.FillEllipse($brush, $p.X - ($r/2), $p.Y - ($r/2), $r, $r) }
      }
      'prod' {
        $w = $size * 0.34; $h = $size * 0.26
        $rect = New-Object System.Drawing.RectangleF ($cx - $w/2), ($cy - $h/2), $w, $h
        $path = New-RoundedRectPath $rect ([Math]::Max(4, [int]($size * 0.08)))
        $g.DrawPath($pen, $path)
        $path.Dispose()
        $g.DrawLine($pen, $rect.X + ($w * 0.2), $rect.Y + ($h * 0.35), $rect.X + ($w * 0.8), $rect.Y + ($h * 0.35))
        $g.DrawLine($pen, $rect.X + ($w * 0.2), $rect.Y + ($h * 0.65), $rect.X + ($w * 0.8), $rect.Y + ($h * 0.65))
      }
      'open' {
        $w = $size * 0.34; $h = $size * 0.28
        $rect = New-Object System.Drawing.RectangleF ($cx - $w/2), ($cy - $h/2), $w, $h
        $path = New-RoundedRectPath $rect ([Math]::Max(4, [int]($size * 0.08)))
        $g.DrawPath($pen, $path); $path.Dispose()
        $g.DrawLine($pen, $cx - ($size * 0.05), $cy, $cx + ($size * 0.13), $cy)
        $g.DrawLine($pen, $cx + ($size * 0.06), $cy - ($size * 0.07), $cx + ($size * 0.13), $cy)
        $g.DrawLine($pen, $cx + ($size * 0.06), $cy + ($size * 0.07), $cx + ($size * 0.13), $cy)
      }
      'restart' {
        $diam = $size * 0.34
        $rect = New-Object System.Drawing.RectangleF ($cx - $diam/2), ($cy - $diam/2), $diam, $diam
        $g.DrawArc($pen, $rect, 30, 280)
        $g.DrawLine($pen, $cx + ($diam*0.36), $cy - ($diam*0.05), $cx + ($diam*0.22), $cy - ($diam*0.18))
        $g.DrawLine($pen, $cx + ($diam*0.36), $cy - ($diam*0.05), $cx + ($diam*0.18), $cy + ($diam*0.02))
      }
      'stop' {
        $side = $size * 0.22
        $rect = New-Object System.Drawing.RectangleF ($cx - $side/2), ($cy - $side/2), $side, $side
        $g.FillRectangle($brush, $rect)
      }
      'repair' {
        $g.DrawLine($pen, $cx - ($size*0.14), $cy + ($size*0.08), $cx + ($size*0.12), $cy - ($size*0.12))
        $g.DrawLine($pen, $cx - ($size*0.04), $cy + ($size*0.18), $cx + ($size*0.18), $cy - ($size*0.04))
        $r = [Math]::Max(3, [int]($size * 0.08))
        $g.FillEllipse($brush, $cx - ($size*0.2), $cy + ($size*0.08), $r, $r)
      }
    }
  } finally {
    $brush.Dispose()
    $pen.Dispose()
  }
}

function New-ShortcutBitmap([int]$size, [string]$kind, [string]$accentHex, [string]$badgeText) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $accent = [System.Drawing.ColorTranslator]::FromHtml($accentHex)
  $bg1 = [System.Drawing.ColorTranslator]::FromHtml('#0b1020')
  $bg2 = [System.Drawing.ColorTranslator]::FromHtml('#171f35')
  $g.Clear([System.Drawing.Color]::Transparent)
  $pad = [Math]::Max(1, [int]($size * 0.08))
  $rect = New-Object System.Drawing.RectangleF $pad, $pad, ($size - 2*$pad), ($size - 2*$pad)
  $path = New-RoundedRectPath $rect ([Math]::Max(6, [int]($size * 0.24)))
  try {
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $bg1, $bg2, 38)
    $g.FillPath($bg, $path)
    $hl = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      $rect,
      [System.Drawing.Color]::FromArgb(55, 255, 255, 255),
      [System.Drawing.Color]::FromArgb(0, 255, 255, 255),
      130
    )
    $g.FillPath($hl, $path)
    $border = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(95, $accent.R, $accent.G, $accent.B), [Math]::Max(1, [int]($size * 0.03)))
    $g.DrawPath($border, $path)
    Draw-Glyph -g $g -kind $kind -size $size -accent $accent
    if ($size -ge 96) {
      $badgeW = [int]($size * 0.46)
      $badgeH = [int]($size * 0.18)
      $badgeRect = New-Object System.Drawing.RectangleF $pad, ($size - $pad - $badgeH), $badgeW, $badgeH
      $badgePath = New-RoundedRectPath $badgeRect ([Math]::Max(5, [int]($size * 0.09)))
      $bFill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 0, 0, 0))
      $bPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(165, $accent.R, $accent.G, $accent.B), [Math]::Max(1, [int]($size * 0.012)))
      $g.FillPath($bFill, $badgePath)
      $g.DrawPath($bPen, $badgePath)
      $font = New-Object System.Drawing.Font("Segoe UI", [Math]::Max(8, [int]($size * 0.085)), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      $fmt = New-Object System.Drawing.StringFormat
      $fmt.Alignment = "Center"
      $fmt.LineAlignment = "Center"
      $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(242, 244, 250, 255))
      $g.DrawString($badgeText, $font, $ink, $badgeRect, $fmt)
      $ink.Dispose(); $fmt.Dispose(); $font.Dispose(); $bPen.Dispose(); $bFill.Dispose(); $badgePath.Dispose()
    }
    $border.Dispose()
    $hl.Dispose()
    $bg.Dispose()
  } finally {
    $path.Dispose()
    $g.Dispose()
  }
  return $bmp
}

function New-MultiSizeIcon([string]$path, [string]$kind, [string]$accentHex, [string]$badgeText) {
  if (-not $Force -and (Test-Path $path)) { return }
  $sizes = @(16, 24, 32, 48, 64, 128, 256)
  $pngs = New-Object "System.Collections.Generic.List[byte[]]"
  foreach ($s in $sizes) {
    $bmp = New-ShortcutBitmap -size $s -kind $kind -accentHex $accentHex -badgeText $badgeText
    try {
      $ms = New-Object System.IO.MemoryStream
      try {
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngs.Add($ms.ToArray()) | Out-Null
      } finally {
        $ms.Dispose()
      }
    } finally {
      $bmp.Dispose()
    }
  }
  Save-IcoFromPngImages -path $path -pngImages $pngs -sizes $sizes
}

$iconSpecs = @(
  @{ Key = 'dev'; File = 'dashboard-dev.ico'; Kind = 'dev'; Accent = '#38bdf8'; Badge = 'DEV' },
  @{ Key = 'prod'; File = 'dashboard-prod.ico'; Kind = 'prod'; Accent = '#c9972f'; Badge = 'PRO' },
  @{ Key = 'hub'; File = 'dashboard-hub.ico'; Kind = 'open'; Accent = '#0f8b8d'; Badge = 'HUB' },
  @{ Key = 'open'; File = 'dashboard-open.ico'; Kind = 'open'; Accent = '#1459c7'; Badge = 'UI' },
  @{ Key = 'restart'; File = 'dashboard-restart.ico'; Kind = 'restart'; Accent = '#f59e0b'; Badge = 'RST' },
  @{ Key = 'stop'; File = 'dashboard-stop.ico'; Kind = 'stop'; Accent = '#ef4444'; Badge = 'STOP' },
  @{ Key = 'repair'; File = 'dashboard-repair.ico'; Kind = 'repair'; Accent = '#a855f7'; Badge = 'FIX' }
)

$iconPathMap = @{}
foreach ($spec in $iconSpecs) {
  $iconPath = Join-Path $iconDir $spec.File
  New-MultiSizeIcon -path $iconPath -kind $spec.Kind -accentHex $spec.Accent -badgeText $spec.Badge
  $iconPathMap[$spec.Key] = $iconPath
}

$canonicalInstallerIcon = Join-Path $root 'scripts\icons\installer-canonical.ico'
if (Test-Path -LiteralPath $canonicalInstallerIcon) {
  $iconPathMap['hub'] = $canonicalInstallerIcon
}

$iconPathForLnk = @{}
foreach ($spec in $iconSpecs) {
  $source = $iconPathMap[$spec.Key]
  $final = $source
  if ($localIconDir) {
    try {
      $dest = Join-Path $localIconDir $spec.File
      Copy-Item -LiteralPath $source -Destination $dest -Force
      $final = $dest
    } catch {
      $final = $source
    }
  }
  $iconPathForLnk[$spec.Key] = $final
}

$shortcuts = @(
  @{
    Name = 'EvaluaPro - Dev'
    Description = 'Bandeja (tray) modo desarrollo - arranque estricto de stack + portal'
    IconKey = 'dev'
    Desktop = $true
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$trayHiddenVbs`" dev $Port"
  },
  @{
    Name = 'EvaluaPro - Prod'
    Description = 'Bandeja (tray) modo estable - arranque estricto de stack + portal'
    IconKey = 'prod'
    Desktop = $true
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$trayHiddenVbs`" prod $Port"
  },
  @{
    Name = 'EvaluaPro - Hub'
    Description = 'Installer Hub local para instalar, verificar, reparar y operar EvaluaPro'
    IconKey = 'hub'
    Desktop = $true
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" open-hub $Port auto"
  },
  @{
    Name = 'EvaluaPro - Abrir Dashboard'
    Description = 'Abre dashboard local y asegura backend de control'
    IconKey = 'open'
    Desktop = $false
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" open-dashboard $Port auto"
  },
  @{
    Name = 'EvaluaPro - Reiniciar Stack'
    Description = 'Reinicia stack y valida salud de servicios clave'
    IconKey = 'restart'
    Desktop = $false
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" restart-stack $Port auto"
  },
  @{
    Name = 'EvaluaPro - Detener Todo'
    Description = 'Solicita detener procesos activos del stack local'
    IconKey = 'stop'
    Desktop = $false
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" stop-all $Port auto"
  },
  @{
    Name = 'EvaluaPro - Reparar Entorno'
    Description = 'Ejecuta reparación automática y validación de salud'
    IconKey = 'repair'
    Desktop = $false
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" repair $Port auto"
  }
)

if (-not $IncludeOpsShortcuts) {
  $shortcuts = $shortcuts | Where-Object { $_.Name -in @('EvaluaPro - Dev', 'EvaluaPro - Prod', 'EvaluaPro - Hub') }
}

$destinations = @()
if ($SyncRepoOutput) {
  $destinations += @{ Name = 'Repo'; Path = $outputPath; Include = $true; UseDesktopFlag = $false; UseStartMenuFlag = $false }
}
if ($SyncDesktop) {
  foreach ($desktopCandidate in $desktopPathCandidates) {
    if ($desktopCandidate) {
      $destinations += @{ Name = 'Desktop'; Path = $desktopCandidate; Include = $true; UseDesktopFlag = $true; UseStartMenuFlag = $false }
    }
  }
}
if ($SyncStartMenu -and $startMenuPath) {
  $destinations += @{ Name = 'StartMenu'; Path = $startMenuPath; Include = $true; UseDesktopFlag = $false; UseStartMenuFlag = $true }
}

function Should-CreateShortcut($shortcut, $destination) {
  if (-not $destination.Include) { return $false }
  if (-not $destination.UseDesktopFlag -and -not $destination.UseStartMenuFlag) { return $true }
  if ($destination.UseDesktopFlag) { return [bool]$shortcut.Desktop }
  if ($destination.UseStartMenuFlag) { return [bool]$shortcut.StartMenu }
  return $false
}

function Remove-LegacyShortcuts([string]$dirPath) {
  if (-not (Test-Path $dirPath)) { return }
  $patterns = @('Sistema Evaluacion - *.lnk', 'EvaluaPro - *.lnk', 'Sistema EvaluaPro - *.lnk')
  foreach ($pattern in $patterns) {
    Get-ChildItem -Path $dirPath -Filter $pattern -ErrorAction SilentlyContinue | ForEach-Object {
      try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}

$wsh = New-Object -ComObject WScript.Shell

function Create-Lnk([string]$dirPath, $shortcutDef) {
  if (-not (Test-Path $dirPath)) {
    New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
  }
  $lnkPath = Join-Path $dirPath ($shortcutDef.Name + '.lnk')
  $lnk = $wsh.CreateShortcut($lnkPath)
  $lnk.TargetPath = $shortcutDef.Target
  $lnk.Arguments = $shortcutDef.Arguments
  $lnk.WorkingDirectory = $root
  $lnk.Description = $shortcutDef.Description
  $lnk.IconLocation = "$($iconPathForLnk[$shortcutDef.IconKey]),0"
  $lnk.Save()
}

if ($Force) {
  foreach ($dest in $destinations) {
    Remove-LegacyShortcuts -dirPath $dest.Path
  }
}

foreach ($dest in $destinations) {
  foreach ($shortcutDef in $shortcuts) {
    if (Should-CreateShortcut -shortcut $shortcutDef -destination $dest) {
      Create-Lnk -dirPath $dest.Path -shortcutDef $shortcutDef
    }
  }
}

Write-Host "Accesos directos regenerados:"
foreach ($dest in $destinations) {
  Write-Host " - $($dest.Name): $($dest.Path)"
}

$manifestScript = Join-Path $root 'scripts\generate-installation-manifest.ps1'
if (Test-Path -LiteralPath $manifestScript) {
  try {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $manifestScript -Port $Port | Out-Null
  } catch {
    Write-Warning "No se pudo actualizar installation.manifest.json: $($_.Exception.Message)"
  }
}
