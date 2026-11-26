param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
  $target = [System.IO.Path]::GetFullPath($InstallerPath)
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { exit 2 }

  $registryPaths = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  $trustedThumbprints = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($registryPath in $registryPaths) {
    if (-not (Test-Path -LiteralPath $registryPath)) { continue }
    foreach ($entry in (Get-ChildItem -LiteralPath $registryPath -ErrorAction SilentlyContinue)) {
      $metadata = Get-ItemProperty -LiteralPath $entry.PSPath -ErrorAction SilentlyContinue
      if (-not $metadata) { continue }
      $displayNameProperty = $metadata.PSObject.Properties['DisplayName']
      $bundlePathProperty = $metadata.PSObject.Properties['BundleCachePath']
      $displayName = if ($displayNameProperty) { [string]$displayNameProperty.Value } else { '' }
      $bundlePath = if ($bundlePathProperty) { [string]$bundlePathProperty.Value } else { '' }
      if ($displayName -notlike '*EvaluaPro*' -or
          [string]::IsNullOrWhiteSpace($bundlePath) -or
          -not (Test-Path -LiteralPath $bundlePath -PathType Leaf)) { continue }

      $fileName = [System.IO.Path]::GetFileName($bundlePath)
      if (-not $fileName.StartsWith('EvaluaPro-InstallerHub-docente-local', [System.StringComparison]::OrdinalIgnoreCase) -or
          -not $fileName.EndsWith('.exe', [System.StringComparison]::OrdinalIgnoreCase)) { continue }
      $installedSignature = Get-AuthenticodeSignature -LiteralPath $bundlePath -ErrorAction SilentlyContinue
      $thumbprint = ''
      if ($installedSignature -and [string]$installedSignature.Status -eq 'Valid' -and $installedSignature.SignerCertificate) {
        $thumbprint = [string]$installedSignature.SignerCertificate.Thumbprint
      }
      if (-not [string]::IsNullOrWhiteSpace($thumbprint)) {
        [void]$trustedThumbprints.Add($thumbprint)
      }
    }
  }
  if ($trustedThumbprints.Count -eq 0) { exit 3 }

  $candidateSignature = Get-AuthenticodeSignature -LiteralPath $target -ErrorAction Stop
  $candidateThumbprint = ''
  if ([string]$candidateSignature.Status -eq 'Valid' -and $candidateSignature.SignerCertificate) {
    $candidateThumbprint = [string]$candidateSignature.SignerCertificate.Thumbprint
  }
  if ([string]$candidateSignature.Status -ne 'Valid' -or
      [string]::IsNullOrWhiteSpace($candidateThumbprint) -or
      -not $trustedThumbprints.Contains($candidateThumbprint)) { exit 4 }

  exit 0
} catch {
  exit 5
}
