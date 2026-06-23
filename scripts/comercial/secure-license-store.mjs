/**
 * secure-license-store
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { execFileSync } from 'node:child_process';
import os from 'node:os';

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

export function guardarTokenSeguro(params) {
  const servicio = String(params?.servicio || 'EvaluaProLicencia');
  const cuenta = String(params?.cuenta || 'tenant');
  const token = String(params?.token || '');
  if (!token) throw new Error('Token requerido');

  if (os.platform() === 'darwin') {
    run('security', [
      'add-generic-password',
      '-a', cuenta,
      '-s', servicio,
      '-w', token,
      '-U'
    ]);
    return { ok: true, backend: 'keychain' };
  }

  if (os.platform() === 'win32') {
    const script = [
      "$ErrorActionPreference='Stop'",
      `$svc='${servicio.replace(/'/g, "''")}'`,
      `$acc='${cuenta.replace(/'/g, "''")}'`,
      `$tok='${token.replace(/'/g, "''")}'`,
      "$sec = ConvertTo-SecureString -String $tok -AsPlainText -Force",
      "$enc = ConvertFrom-SecureString -SecureString $sec",
      "$root = Join-Path $env:ProgramData 'EvaluaPro\\security'",
      "if (!(Test-Path $root)) { New-Item -ItemType Directory -Path $root -Force | Out-Null }",
      "$path = Join-Path $root ($svc + '.' + $acc + '.dpapi.txt')",
      "[IO.File]::WriteAllText($path, $enc, [System.Text.Encoding]::UTF8)",
      "Write-Output $path"
    ].join(';');
    const out = run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]);
    return { ok: true, backend: 'dpapi', path: out };
  }

  throw new Error('Plataforma no soportada para almacenamiento seguro.');
}

export function leerTokenSeguro(params) {
  const servicio = String(params?.servicio || 'EvaluaProLicencia');
  const cuenta = String(params?.cuenta || 'tenant');

  if (os.platform() === 'darwin') {
    const out = run('security', ['find-generic-password', '-a', cuenta, '-s', servicio, '-w']);
    return out;
  }

  if (os.platform() === 'win32') {
    const script = [
      "$ErrorActionPreference='Stop'",
      `$svc='${servicio.replace(/'/g, "''")}'`,
      `$acc='${cuenta.replace(/'/g, "''")}'`,
      "$path = Join-Path (Join-Path $env:ProgramData 'EvaluaPro\\security') ($svc + '.' + $acc + '.dpapi.txt')",
      "if (!(Test-Path $path)) { throw 'Token no encontrado' }",
      "$enc = Get-Content -Path $path -Raw -Encoding utf8",
      "$sec = ConvertTo-SecureString -String $enc",
      "$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)",
      "try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }",
      "Write-Output $plain"
    ].join(';');
    return run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]);
  }

  throw new Error('Plataforma no soportada para almacenamiento seguro.');
}

export function eliminarTokenSeguro(params) {
  const servicio = String(params?.servicio || 'EvaluaProLicencia');
  const cuenta = String(params?.cuenta || 'tenant');

  if (os.platform() === 'darwin') {
    run('security', ['delete-generic-password', '-a', cuenta, '-s', servicio]);
    return { ok: true, backend: 'keychain' };
  }

  if (os.platform() === 'win32') {
    const script = [
      "$ErrorActionPreference='Stop'",
      `$svc='${servicio.replace(/'/g, "''")}'`,
      `$acc='${cuenta.replace(/'/g, "''")}'`,
      "$path = Join-Path (Join-Path $env:ProgramData 'EvaluaPro\\security') ($svc + '.' + $acc + '.dpapi.txt')",
      "if (Test-Path $path) { Remove-Item -LiteralPath $path -Force }"
    ].join(';');
    run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]);
    return { ok: true, backend: 'dpapi' };
  }

  throw new Error('Plataforma no soportada para almacenamiento seguro.');
}
