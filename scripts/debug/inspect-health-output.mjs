import { execSync } from 'child_process'

const prereq = 'c:\\Users\\evega\\EvaluaPro_Sistema_Universitario\\scripts\\installer-burn\\modules\\PrereqDetector.psm1'
const installDir = 'C:\\Users\\evega\\AppData\\Local\\Temp\\evaluapro-debug-1c46ac7f50524caea04cd43beeafd937\\EvaluaPro'
const cmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Import-Module -Force '${prereq}' -DisableNameChecking; Get-EvaluaProInstallationHealth -InstallDir '${installDir}' | ConvertTo-Json -Depth 8`
try {
  const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -Command "' + cmd.replace(/"/g, '\\"') + '"', { encoding: 'utf8' })
  console.log('RAW OUTPUT:\n', out)
  try {
    const parsed = JSON.parse(out)
    console.log('PARSED JSON:', parsed)
  } catch (e) {
    console.log('JSON.parse failed:', e.message)
    const buf = Buffer.from(out, 'latin1')
    const fixed = buf.toString('utf8')
    console.log('FIXED OUTPUT:\n', fixed)
    const parsed2 = JSON.parse(fixed)
    console.log('PARSED FIXED JSON:', parsed2)
  }
} catch (err) {
  console.error('COMMAND FAILED', err.message)
  console.error('stderr:', err.stderr)
}
