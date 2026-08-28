/**
 * total-installation-wipe
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

console.log('=== INICIANDO PURGA TOTAL DE INSTALACIÓN ANTERIOR ===');

const localAppData = process.env.LOCALAPPDATA || 'C:\\Users\\evega\\AppData\\Local';
const programData = process.env.ProgramData || 'C:\\ProgramData';
const userProfile = process.env.USERPROFILE || 'C:\\Users\\evega';
const oneDrive = process.env.OneDrive || '';
const publicDir = process.env.PUBLIC || 'C:\\Users\\Public';
const appData = process.env.APPDATA || path.join(userProfile, 'AppData', 'Roaming');

// 1. Directorios de datos y runtime instalado
const targets = [
  path.join(localAppData, 'EvaluaPro'),
  path.join(programData, 'EvaluaPro'),
  'C:\\Users\\Public\\Documents\\EvaluaPro_Backup',
  path.join(process.cwd(), 'apps', 'backend', 'data'),
  path.join(process.cwd(), 'apps', 'portal_alumno_cloud', 'data')
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    try {
      if (target.includes('apps') && target.endsWith('data')) {
        for (const item of fs.readdirSync(target)) {
          const fullPath = path.join(target, item);
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
        console.log('✓ Workspace data vaciado:', target);
      } else {
        fs.rmSync(target, { recursive: true, force: true });
        console.log('✓ Directorio de instalación eliminado:', target);
      }
    } catch (err) {
      console.warn('! Error eliminando con fs:', err.message);
      try {
        execSync(`cmd /c rmdir /s /q "${target}"`, { stdio: 'ignore' });
        console.log('✓ Directorio eliminado vía cmd:', target);
      } catch {}
    }
  } else {
    console.log('- No existe (ya limpio):', target);
  }
}

// 2. Limpiar Package Cache
for (const cacheBase of [path.join(programData, 'Package Cache'), path.join(localAppData, 'Package Cache')]) {
  if (fs.existsSync(cacheBase)) {
    try {
      const items = fs.readdirSync(cacheBase);
      for (const item of items) {
        if (item.toLowerCase().includes('evaluapro')) {
          fs.rmSync(path.join(cacheBase, item), { recursive: true, force: true });
          console.log('✓ Package Cache limpiado:', item);
        }
      }
    } catch {}
  }
}

// 3. Limpiar accesos directos de Escritorio y Menú Inicio (estado 100% pre-instalación)
const desktopDirs = [
  path.join(userProfile, 'Desktop'),
  oneDrive ? path.join(oneDrive, 'Desktop') : null,
  path.join(publicDir, 'Desktop')
].filter(Boolean);

for (const dir of desktopDirs) {
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (file.toLowerCase().includes('evaluapro')) {
        const p = path.join(dir, file);
        try {
          fs.rmSync(p, { force: true, recursive: true });
          console.log('✓ Eliminado acceso de Escritorio:', p);
        } catch {}
      }
    }
  }
}

const startMenuDirs = [
  path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'EvaluaPro'),
  path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'EvaluaPro'),
  path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
].filter(Boolean);

for (const dir of startMenuDirs) {
  if (fs.existsSync(dir)) {
    if (dir.endsWith('EvaluaPro')) {
      try {
        fs.rmSync(dir, { force: true, recursive: true });
        console.log('✓ Eliminada carpeta de Menú Inicio:', dir);
      } catch {}
    } else {
      for (const file of fs.readdirSync(dir)) {
        if (file.toLowerCase().includes('evaluapro')) {
          const p = path.join(dir, file);
          try {
            fs.rmSync(p, { force: true, recursive: true });
            console.log('✓ Eliminado acceso de Menú Inicio:', p);
          } catch {}
        }
      }
    }
  }
}

// 4. Limpiar registro HKCU
try {
  execSync('powershell -NoProfile -Command "Remove-Item -Path HKCU:\\Software\\EvaluaPro -Recurse -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
  console.log('✓ Claves de registro HKCU:\\Software\\EvaluaPro eliminadas.');
} catch {}

// 5. Notificar a Windows Explorer
try {
  execSync('powershell -NoProfile -Command "if (Get-Command ie4uinit.exe -ErrorAction SilentlyContinue) { & ie4uinit.exe -show }"', { stdio: 'ignore' });
} catch {}

console.log('=== PURGA TOTAL COMPLETADA EXITOSAMENTE (SISTEMA EN ESTADO PRE-INSTALACIÓN) ===');
