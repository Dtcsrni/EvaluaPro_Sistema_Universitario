function Remove-NpmWorkspaceLink {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$LiteralPath
  )

  $entry = Get-Item -LiteralPath $LiteralPath -Force -ErrorAction SilentlyContinue
  if ($null -eq $entry) {
    return
  }

  $isReparsePoint = ($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
  if ($entry.PSIsContainer) {
    [System.IO.Directory]::Delete($entry.FullName, -not $isReparsePoint)
  } else {
    [System.IO.File]::Delete($entry.FullName)
  }

  if ([System.IO.File]::Exists($entry.FullName) -or [System.IO.Directory]::Exists($entry.FullName)) {
    throw "No se pudo retirar el enlace opcional del workspace npm: $LiteralPath"
  }
}
