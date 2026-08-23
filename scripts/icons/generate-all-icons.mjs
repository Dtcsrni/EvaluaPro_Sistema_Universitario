#!/usr/bin/env node
/**
 * generate-all-icons.mjs
 *
 * Genera todos los archivos .ico oficiales de EvaluaPro en formato multi-resolución
 * (256x256 PNG + 128, 64, 48, 32, 24, 16 32bpp DIB con canal alfa y máscara AND)
 * 100% compatible con Windows Explorer, Windows Shell y el WiX Toolset.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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

  // 3. AND mask (bottom-to-top 1-bit mask, 0 = opaque, 1 = transparent)
  let andOffset = 40 + xorSize;
  for (let y = height - 1; y >= 0; y--) {
    let bitIdx = 0;
    let byteVal = 0;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const a = rawPixels[srcIdx + 3];
      if (a === 0) {
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
  console.log(`✓ ${path.relative(root, outputPath)} (${finalIcoBuffer.length} bytes) generado correctamente.`);
}

async function main() {
  const officialLogoPath = path.join(root, 'docs', 'release', 'manual', 'oauth-logo-evaluapro-512.png');
  const installerLogoPath = path.join(root, 'logos', 'evaluapro-installer-logo-contrast.png');

  const officialBuf = fs.readFileSync(officialLogoPath);
  const installerBuf = fs.readFileSync(installerLogoPath);

  console.log('Generando suite de iconos Windows oficiales multi-resolución...');

  // 1. Icono principal de producto / Docente Prod
  await generateIco(officialBuf, path.join(root, 'scripts', 'icons', 'dashboard-prod.ico'));

  // 2. Iconos de Installer Hub y Canonical
  await generateIco(installerBuf, path.join(root, 'scripts', 'icons', 'installer-canonical.ico'));
  await generateIco(installerBuf, path.join(root, 'scripts', 'icons', 'installer-logo-contrast.ico'));
  await generateIco(installerBuf, path.join(root, 'scripts', 'icons', 'dashboard-hub.ico'));
  await generateIco(installerBuf, path.join(root, 'scripts', 'icons', 'dashboard-hub-app.ico'));

  // 3. Iconos auxiliares de dashboard / desarrollo / operaciones
  await generateIco(officialBuf, path.join(root, 'scripts', 'icons', 'dashboard-dev.ico'));
  await generateIco(officialBuf, path.join(root, 'scripts', 'icons', 'dashboard-open.ico'));
  await generateIco(officialBuf, path.join(root, 'scripts', 'icons', 'dashboard-restart.ico'));
  await generateIco(officialBuf, path.join(root, 'scripts', 'icons', 'dashboard-stop.ico'));
  await generateIco(officialBuf, path.join(root, 'scripts', 'icons', 'dashboard-repair.ico'));

  // 4. Sincronizar con la instalación local si existe
  const localAppDataIcons = path.join(process.env.LOCALAPPDATA || '', 'EvaluaPro', 'scripts', 'icons');
  if (fs.existsSync(localAppDataIcons)) {
    console.log(`Sincronizando iconos con instalación local: ${localAppDataIcons}`);
    for (const file of fs.readdirSync(path.join(root, 'scripts', 'icons')).filter(f => f.endsWith('.ico'))) {
      fs.copyFileSync(path.join(root, 'scripts', 'icons', file), path.join(localAppDataIcons, file));
    }
  }

  // 5. Refrescar accesos directos en el escritorio del usuario
  const installFolder = path.join(process.env.LOCALAPPDATA || '', 'EvaluaPro');
  const targetWscript = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'wscript.exe');

  if (fs.existsSync(installFolder)) {
    const shortcutsToUpdate = [
      {
        name: 'EvaluaPro.lnk',
        icon: path.join(installFolder, 'scripts', 'icons', 'dashboard-prod.ico'),
        args: `//nologo "${path.join(installFolder, 'scripts', 'launcher-tray-hidden.vbs')}" prod 4000`
      },
      {
        name: 'EvaluaPro - Prod.lnk',
        icon: path.join(installFolder, 'scripts', 'icons', 'dashboard-prod.ico'),
        args: `//nologo "${path.join(installFolder, 'scripts', 'launcher-tray-hidden.vbs')}" prod 4000`
      },
      {
        name: 'EvaluaPro - Hub.lnk',
        icon: path.join(installFolder, 'scripts', 'icons', 'installer-canonical.ico'),
        args: `//nologo "${path.join(installFolder, 'scripts', 'shortcut-op-hidden.vbs')}" open-hub 4000 auto`
      }
    ];

    const updateScript = `
$sh = New-Object -ComObject WScript.Shell
$desktop = "$([Environment]::GetFolderPath('Desktop'))"

${shortcutsToUpdate.map(s => `
$lnkPath = Join-Path $desktop "${s.name}"
if (Test-Path $lnkPath) {
  $lnk = $sh.CreateShortcut($lnkPath)
  $lnk.TargetPath = "${targetWscript.replace(/\\/g, '\\\\')}"
  $lnk.Arguments = '${s.args.replace(/\\/g, '\\\\')}'
  $lnk.WorkingDirectory = "${installFolder.replace(/\\/g, '\\\\')}"
  $lnk.IconLocation = "${s.icon.replace(/\\/g, '\\\\')},0"
  $lnk.Save()
  Write-Host "Acceso directo actualizado: ${s.name}"
}
`).join('\n')}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ShellNotifier {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@
[ShellNotifier]::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)
`;

    const tempPs1 = path.join(root, 'temp-refresh-shortcuts.ps1');
    fs.writeFileSync(tempPs1, updateScript, 'utf8');
    const { execSync } = await import('node:child_process');
    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`, { stdio: 'inherit' });
    } catch {}
    try { fs.unlinkSync(tempPs1); } catch {}
  }

  console.log('✓ Generación y sincronización de iconos completada exitosamente.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
