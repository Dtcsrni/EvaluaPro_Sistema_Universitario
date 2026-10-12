Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:AllowedTransitions = @{
  created = @('staging', 'stopping', 'recovery_required')
  staging = @('validated', 'recovery_required')
  validated = @('stopping', 'promoting', 'recovery_required')
  stopping = @('promoting', 'recovery_required')
  promoting = @('configuring', 'verifying', 'recovery_required')
  configuring = @('verifying', 'recovery_required')
  verifying = @('committed', 'recovery_required')
  committed = @()
  recovery_required = @('recovering')
  recovering = @('recovered', 'recovery_required')
  recovered = @()
}

function Assert-EvaluaProInstallPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $root = [IO.Path]::GetFullPath($Path)
  $volumeRoot = [IO.Path]::GetPathRoot($root)
  if ([string]::IsNullOrWhiteSpace($volumeRoot) -or $root.TrimEnd('\') -eq $volumeRoot.TrimEnd('\')) {
    throw "La raíz de instalación no es válida: $Path"
  }
  $current = $root
  while (-not [string]::IsNullOrWhiteSpace($current) -and $current.Length -ge $volumeRoot.Length) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "La ruta de instalación contiene un enlace/reparse point y se rechaza: $current"
      }
    }
    if ($current.TrimEnd('\') -eq $volumeRoot.TrimEnd('\')) { break }
    $current = Split-Path -Parent $current
  }
  return $root.TrimEnd('\')
}

function Set-EvaluaProOperationState {
  param(
    [Parameter(Mandatory = $true)][object]$Journal,
    [Parameter(Mandatory = $true)][ValidateSet('created','staging','validated','stopping','promoting','configuring','verifying','committed','recovery_required','recovering','recovered')][string]$State
  )

  $current = [string]$Journal.state
  if ($State -ne $current -and $State -notin @($script:AllowedTransitions[$current])) {
    throw "Transición de Installer Hub no permitida: $current -> $State."
  }
  $updatedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
  if ($Journal -is [System.Collections.IDictionary]) {
    $Journal['state'] = $State
    $Journal['updatedAtUtc'] = $updatedAtUtc
  } else {
    $Journal.state = $State
    $updatedAtProperty = $Journal.PSObject.Properties['updatedAtUtc']
    if ($updatedAtProperty) { $updatedAtProperty.Value = $updatedAtUtc }
    else { $Journal | Add-Member -NotePropertyName updatedAtUtc -NotePropertyValue $updatedAtUtc }
  }
  return $Journal
}

Export-ModuleMember -Function @('Assert-EvaluaProInstallPath', 'Set-EvaluaProOperationState')
