#!/usr/bin/env node
/**
 * generate-all-icons
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * generate-all-icons.mjs
 *
 * Genera todos los archivos .ico oficiales de EvaluaPro en formato multi-resolución
 * (256x256 PNG + 128, 64, 48, 32, 24, 16 32bpp DIB con canal alfa transparente y máscara AND)
 * 100% compatible con Windows Explorer, Windows Shell y el WiX Toolset.
 *
 * Produce exclusivamente los 2 íconos transparentes oficiales:
 * 1. EvaluaPro (Aplicación Docente)
 * 2. EvaluaPro - Hub (Installer Hub y Centro de Mantenimiento)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const EVALUAPRO_APP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="appBg" x1="64" y1="48" x2="448" y2="464" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06111e"/>
      <stop offset="50%" stop-color="#0c233c"/>
      <stop offset="100%" stop-color="#123356"/>
    </linearGradient>
    <linearGradient id="appRing" x1="48" y1="48" x2="464" y2="464" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="35%" stop-color="#00D2FF"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <linearGradient id="capGold" x1="160" y1="120" x2="352" y2="240" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="checkGrad" x1="270" y1="320" x2="360" y2="390" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>

  <!-- Squircle con transparencia exterior total (Alpha = 0 fuera del rectangulo redondeado) -->
  <rect x="44" y="44" width="424" height="424" rx="96" fill="url(#appBg)"/>
  <rect x="44" y="44" width="424" height="424" rx="96" fill="none" stroke="url(#appRing)" stroke-width="12" opacity="0.95"/>

  <!-- Birrete Superior -->
  <polygon points="256,104 396,168 256,232 116,168" fill="url(#capGold)" stroke="#92400E" stroke-width="5" stroke-linejoin="round"/>
  <path d="M174,198 v38 c0 26 36 44 82 44 s82 -18 82 -44 v-38" fill="none" stroke="#FDE68A" stroke-width="10" stroke-linecap="round"/>
  <path d="M388,172 v66" stroke="#00D2FF" stroke-width="8" stroke-linecap="round"/>
  <circle cx="388" cy="244" r="12" fill="#00D2FF"/>
  <circle cx="256" cy="168" r="7" fill="#FEF3C7"/>

  <!-- Hoja de Examen / Evaluacion con lineas y checkmark OMR -->
  <rect x="156" y="272" width="200" height="136" rx="20" fill="#FFFFFF"/>
  <line x1="184" y1="310" x2="274" y2="310" stroke="#475569" stroke-width="10" stroke-linecap="round"/>
  <line x1="184" y1="344" x2="248" y2="344" stroke="#64748B" stroke-width="10" stroke-linecap="round"/>
  <line x1="184" y1="378" x2="228" y2="378" stroke="#94A3B8" stroke-width="8" stroke-linecap="round"/>
  <path d="M272,352 l26,26 l58,-58" fill="none" stroke="url(#checkGrad)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export const EVALUAPRO_HUB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="hubBg" x1="64" y1="48" x2="448" y2="464" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#040d18"/>
      <stop offset="50%" stop-color="#091f33"/>
      <stop offset="100%" stop-color="#0e2e4a"/>
    </linearGradient>
    <linearGradient id="hubRing" x1="48" y1="48" x2="464" y2="464" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00D2FF"/>
      <stop offset="50%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="hubCapGold" x1="180" y1="140" x2="332" y2="260" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="60%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
  </defs>

  <!-- Squircle con transparencia exterior total -->
  <rect x="44" y="44" width="424" height="424" rx="96" fill="url(#hubBg)"/>
  <rect x="44" y="44" width="424" height="424" rx="96" fill="none" stroke="url(#hubRing)" stroke-width="12" opacity="0.95"/>

  <!-- Anillos orbitales del Hub / Asistente -->
  <circle cx="256" cy="256" r="150" fill="none" stroke="#00D2FF" stroke-width="5" stroke-dasharray="12 10" opacity="0.6"/>
  <circle cx="256" cy="256" r="110" fill="none" stroke="#38BDF8" stroke-width="3" opacity="0.35"/>

  <!-- Nodos satelite -->
  <circle cx="256" cy="106" r="12" fill="#00D2FF"/>
  <circle cx="406" cy="256" r="12" fill="#38BDF8"/>
  <circle cx="256" cy="406" r="12" fill="#10B981"/>
  <circle cx="106" cy="256" r="12" fill="#F59E0B"/>

  <!-- Birrete Central -->
  <polygon points="256,154 376,208 256,262 136,208" fill="url(#hubCapGold)" stroke="#92400E" stroke-width="5" stroke-linejoin="round"/>
  <path d="M188,234 v30 c0 22 30 36 68 36 s68 -14 68 -36 v-30" fill="none" stroke="#FDE68A" stroke-width="9" stroke-linecap="round"/>
  <path d="M370,212 v52" stroke="#00D2FF" stroke-width="8" stroke-linecap="round"/>
  <circle cx="370" cy="268" r="10" fill="#00D2FF"/>

  <!-- Engrane / Hub de control inferior -->
  <circle cx="256" cy="350" r="28" fill="#081E32" stroke="#00D2FF" stroke-width="7"/>
  <path d="M256,336 v28 M242,350 h28" stroke="#00D2FF" stroke-width="5" stroke-linecap="round"/>
</svg>`;

function createBmpDibFrame(rawPixels, width, height) {
  const headerSize = 40;
  const xorSize = width * height * 4;
  const andRowBytes = Math.ceil(width / 32) * 4;
  const andSize = andRowBytes * height;
  const totalFrameSize = headerSize + xorSize + andSize;

  const buf = Buffer.alloc(totalFrameSize);

  // 1. BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 0);
  buf.writeInt32LE(width, 4);
  buf.writeInt32LE(height * 2, 8); // Double height for XOR + AND
  buf.writeUInt16LE(1, 12);
  buf.writeUInt16LE(32, 14); // 32 bpp
  buf.writeUInt32LE(0, 16); // BI_RGB
  buf.writeUInt32LE(xorSize + andSize, 20);
  buf.writeInt32LE(0, 24);
  buf.writeInt32LE(0, 28);
  buf.writeUInt32LE(0, 32);
  buf.writeUInt32LE(0, 36);

  // 2. XOR mask (bottom-to-top BGRA)
  let xorOffset = 40;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const r = rawPixels[srcIdx];
      const g = rawPixels[srcIdx + 1];
      const b = rawPixels[srcIdx + 2];
      const a = rawPixels[srcIdx + 3];

      buf[xorOffset++] = b;
      buf[xorOffset++] = g;
      buf[xorOffset++] = r;
      buf[xorOffset++] = a;
    }
  }

  // 3. AND mask (bottom-to-top 1-bit mask, 0 = visible, 1 = transparent)
  let andOffset = 40 + xorSize;
  for (let y = height - 1; y >= 0; y--) {
    let bitIdx = 0;
    let byteVal = 0;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const a = rawPixels[srcIdx + 3];
      if (a < 128) {
        byteVal |= (1 << (7 - (bitIdx % 8)));
      }
      bitIdx++;
      if (bitIdx % 8 === 0) {
        buf[andOffset++] = byteVal;
        byteVal = 0;
      }
    }
    if (bitIdx % 8 !== 0) {
      buf[andOffset++] = byteVal;
    }
    const writtenInRow = Math.ceil(width / 8);
    const padding = andRowBytes - writtenInRow;
    for (let p = 0; p < padding; p++) {
      buf[andOffset++] = 0;
    }
  }

  return buf;
}

export async function generateIco(sourceBuffer, outputPath) {
  const sizes = [256, 128, 64, 48, 32, 24, 16];
  const frames = [];

  for (const size of sizes) {
    if (size === 256) {
      const pngBuf = await sharp(sourceBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toBuffer();
      frames.push({ size, buffer: pngBuf });
    } else {
      const raw = await sharp(sourceBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .ensureAlpha()
        .raw()
        .toBuffer();
      const dibBuf = createBmpDibFrame(raw, size, size);
      frames.push({ size, buffer: dibBuf });
    }
  }

  const count = frames.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let currentOffset = headerSize + count * dirEntrySize;

  const headerBuf = Buffer.alloc(headerSize);
  headerBuf.writeUInt16LE(0, 0);
  headerBuf.writeUInt16LE(1, 2);
  headerBuf.writeUInt16LE(count, 4);

  const entries = [];
  for (const item of frames) {
    const entryBuf = Buffer.alloc(dirEntrySize);
    entryBuf.writeUInt8(item.size >= 256 ? 0 : item.size, 0);
    entryBuf.writeUInt8(item.size >= 256 ? 0 : item.size, 1);
    entryBuf.writeUInt8(0, 2);
    entryBuf.writeUInt8(0, 3);
    entryBuf.writeUInt16LE(1, 4);
    entryBuf.writeUInt16LE(32, 6);
    entryBuf.writeUInt32LE(item.buffer.length, 8);
    entryBuf.writeUInt32LE(currentOffset, 12);
    currentOffset += item.buffer.length;
    entries.push(entryBuf);
  }

  const finalIcoBuffer = Buffer.concat([
    headerBuf,
    ...entries,
    ...frames.map(f => f.buffer)
  ]);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, finalIcoBuffer);
  console.log(`✓ ${path.relative(root, outputPath)} (${finalIcoBuffer.length} bytes) generado con transparencia total.`);
}

async function main() {
  console.log('1. Renderizando SVGs vectoriales y generando PNGs 512x512 con transparencia total...');
  
  const appPngBuf = await sharp(Buffer.from(EVALUAPRO_APP_SVG))
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const hubPngBuf = await sharp(Buffer.from(EVALUAPRO_HUB_SVG))
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Guardar PNGs canónicos
  fs.writeFileSync(path.join(root, 'logos', 'evaluapro-app.png'), appPngBuf);
  fs.writeFileSync(path.join(root, 'logos', 'evaluapro-hub.png'), hubPngBuf);
  fs.writeFileSync(path.join(root, 'docs', 'release', 'manual', 'oauth-logo-evaluapro-512.png'), appPngBuf);
  fs.writeFileSync(path.join(root, 'logos', 'evaluapro-installer-logo-contrast.png'), hubPngBuf);

  console.log('2. Generando suite oficial de íconos multi-resolución .ico con canal alfa...');

  // A) Ícono oficial de la aplicación EvaluaPro
  await generateIco(appPngBuf, path.join(root, 'scripts', 'icons', 'dashboard-prod.ico'));
  await generateIco(appPngBuf, path.join(root, 'scripts', 'icons', 'dashboard-dev.ico'));
  await generateIco(appPngBuf, path.join(root, 'scripts', 'icons', 'dashboard-open.ico'));
  await generateIco(appPngBuf, path.join(root, 'scripts', 'icons', 'dashboard-restart.ico'));
  await generateIco(appPngBuf, path.join(root, 'scripts', 'icons', 'dashboard-stop.ico'));
  await generateIco(appPngBuf, path.join(root, 'scripts', 'icons', 'dashboard-repair.ico'));

  // B) Ícono oficial del Hub (Installer Hub)
  await generateIco(hubPngBuf, path.join(root, 'scripts', 'icons', 'installer-canonical.ico'));
  await generateIco(hubPngBuf, path.join(root, 'scripts', 'icons', 'installer-logo-contrast.ico'));
  await generateIco(hubPngBuf, path.join(root, 'scripts', 'icons', 'dashboard-hub.ico'));
  await generateIco(hubPngBuf, path.join(root, 'scripts', 'icons', 'dashboard-hub-app.ico'));

  // 3. Sincronizar con la instalación local si existe
  const localAppDataIcons = path.join(process.env.LOCALAPPDATA || '', 'EvaluaPro', 'scripts', 'icons');
  if (fs.existsSync(localAppDataIcons)) {
    console.log(`3. Sincronizando íconos con instalación local: ${localAppDataIcons}`);
    for (const file of fs.readdirSync(path.join(root, 'scripts', 'icons')).filter(f => f.endsWith('.ico'))) {
      fs.copyFileSync(path.join(root, 'scripts', 'icons', file), path.join(localAppDataIcons, file));
    }
  }

  // 4. Limpiar accesos directos redundantes y actualizar los 2 únicos accesos oficiales
  const installFolder = path.join(process.env.LOCALAPPDATA || '', 'EvaluaPro');
  const targetWscript = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'wscript.exe');

  const updateScript = `
$sh = New-Object -ComObject WScript.Shell
$desktop = "$([Environment]::GetFolderPath('Desktop'))"
$userProfileDesktop = if ($env:USERPROFILE) { Join-Path $env:USERPROFILE "Desktop" } else { $null }
$startMenuBase = if ($env:APPDATA) { Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs" } else { $null }
$startMenuDir = if ($startMenuBase) { Join-Path $startMenuBase "EvaluaPro" } else { $null }

$dirsToClean = @($desktop, $userProfileDesktop, $startMenuBase, $startMenuDir) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

# Eliminar accesos directos redundantes
$redundantNames = @('EvaluaPro - Prod', 'EvaluaPro - Dev', 'EvaluaPro - Abrir Dashboard', 'EvaluaPro - Reiniciar Stack', 'EvaluaPro - Detener Todo', 'EvaluaPro - Desinstalar', 'EvaluaPro - Reparar Entorno', 'Sistema Evaluacion - *')
foreach ($dir in $dirsToClean) {
  foreach ($pattern in $redundantNames) {
    Get-ChildItem -Path $dir -Filter ($pattern + '.lnk') -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
        Write-Host "Eliminado acceso redundante: $($_.FullName)"
      } catch {}
    }
  }
}

# Crear/actualizar exclusivamente los 2 accesos oficiales en Desktop y Start Menu
$officialShortcuts = @(
  @{
    Name = 'EvaluaPro.lnk'
    Desc = 'EvaluaPro · Plataforma para evaluación universitaria'
    Icon = '${path.join(root, 'scripts', 'icons', 'dashboard-prod.ico').replace(/\\/g, '\\\\')}'
    Args = '//nologo "${path.join(root, 'scripts', 'launcher-tray-hidden.vbs').replace(/\\/g, '\\\\')}" prod 4519'
    WorkingDir = '${root.replace(/\\/g, '\\\\')}'
  },
  @{
    Name = 'EvaluaPro - Hub.lnk'
    Desc = 'EvaluaPro Hub · Asistente local para instalar, verificar, reparar y operar'
    Icon = '${path.join(root, 'scripts', 'icons', 'installer-canonical.ico').replace(/\\/g, '\\\\')}'
    Args = '//nologo "${path.join(root, 'scripts', 'shortcut-op-hidden.vbs').replace(/\\/g, '\\\\')}" open-hub 4519 auto'
    WorkingDir = '${root.replace(/\\/g, '\\\\')}'
  }
)

$targetLocations = @($desktop)
if ($startMenuDir) {
  if (-not (Test-Path $startMenuDir)) { New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null }
  $targetLocations += $startMenuDir
}

foreach ($loc in $targetLocations) {
  foreach ($sc in $officialShortcuts) {
    $lnkPath = Join-Path $loc $sc.Name
    $lnk = $sh.CreateShortcut($lnkPath)
    $lnk.TargetPath = '${targetWscript.replace(/\\/g, '\\\\')}'
    $lnk.Arguments = $sc.Args
    $lnk.WorkingDirectory = $sc.WorkingDir
    $lnk.Description = $sc.Desc
    $lnk.IconLocation = "$($sc.Icon),0"
    $lnk.Save()
    Write-Host "[OK] Acceso directo oficial actualizado: $lnkPath"
  }
}

# Notificar al Shell de Windows para refrescar la cache de iconos inmediatamente
if (Get-Command ie4uinit.exe -ErrorAction SilentlyContinue) {
  try { & ie4uinit.exe -show } catch {}
}
`;

  const tempPs1 = path.join(root, 'temp-refresh-shortcuts.ps1');
  fs.writeFileSync(tempPs1, updateScript, 'utf8');
  const { execSync } = await import('node:child_process');
  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`, { stdio: 'inherit' });
  } catch {}
  try { fs.unlinkSync(tempPs1); } catch {}

  console.log('✓ Generación de íconos transparentes y normalización de accesos directos completada con éxito.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

