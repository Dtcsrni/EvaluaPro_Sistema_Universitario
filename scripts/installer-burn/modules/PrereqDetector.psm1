# Obsolete: Reemplazado por logica nativa en InstallerBurnHelper.ps1
# Se conserva este archivo como stub para compatibilidad de otras firmas de scripts.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NativePrerequisites {
  $edgeInstalled = $false
  $edgeKeys = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  )
  foreach ($key in $edgeKeys) {
    if (Test-Path $key) {
        $edgeInstalled = $true
        break
    }
  }

  return @{
    EdgeWebView2 = $edgeInstalled
  }
}
