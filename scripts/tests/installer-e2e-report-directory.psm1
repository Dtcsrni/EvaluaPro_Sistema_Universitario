Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Initialize-InstallerHubE2EReportDirectory {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$Path)

  $fullPath = [IO.Path]::GetFullPath($Path)
  if (Test-Path -LiteralPath $fullPath) {
    throw "El directorio de reporte ya existe; se rechaza alterar sus ACL o contenido: $fullPath"
  }

  $parentPath = Split-Path -Parent $fullPath
  if (-not (Test-Path -LiteralPath $parentPath -PathType Container)) {
    throw "El padre privado del directorio de reporte no existe: $parentPath"
  }
  $parentItem = Get-Item -LiteralPath $parentPath -Force -ErrorAction Stop
  if (($parentItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "El padre del directorio de reporte es un enlace/reparse point: $parentPath"
  }
  $untrustedSids = @('S-1-1-0', 'S-1-5-11', 'S-1-5-32-545')
  $writeRights = [Security.AccessControl.FileSystemRights]::Write -bor
    [Security.AccessControl.FileSystemRights]::Modify -bor
    [Security.AccessControl.FileSystemRights]::FullControl -bor
    [Security.AccessControl.FileSystemRights]::CreateFiles -bor
    [Security.AccessControl.FileSystemRights]::CreateDirectories -bor
    [Security.AccessControl.FileSystemRights]::Delete -bor
    [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
    [Security.AccessControl.FileSystemRights]::ChangePermissions -bor
    [Security.AccessControl.FileSystemRights]::TakeOwnership
  $parentAcl = Get-Acl -LiteralPath $parentPath -ErrorAction Stop
  foreach ($rule in $parentAcl.Access) {
    if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
    try { $parentSid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { continue }
    if ($parentSid -in $untrustedSids -and ($rule.FileSystemRights -band $writeRights) -ne 0) {
      throw "El padre del directorio de reporte permite reemplazarlo a una identidad local no confiable: $parentPath ($parentSid)."
    }
  }

  $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if (-not $currentSid) { throw 'No se pudo determinar la identidad Windows del runner para proteger el reporte.' }
  $systemSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
  $inheritance = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit
  $propagation = [Security.AccessControl.PropagationFlags]::None
  $allow = [Security.AccessControl.AccessControlType]::Allow
  $fullControl = [Security.AccessControl.FileSystemRights]::FullControl
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetOwner($currentSid)
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($currentSid, $fullControl, $inheritance, $propagation, $allow))
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($systemSid, $fullControl, $inheritance, $propagation, $allow))

  New-Item -ItemType Directory -Path $fullPath -ErrorAction Stop | Out-Null
  Set-Acl -LiteralPath $fullPath -AclObject $acl -ErrorAction Stop
  $createdAcl = Get-Acl -LiteralPath $fullPath -ErrorAction Stop
  if (-not $createdAcl.AreAccessRulesProtected) {
    throw "El ACL del directorio de reporte conserva herencia inesperada: $fullPath"
  }

  $allowedSids = @($createdAcl.Access | Where-Object { $_.AccessControlType -eq $allow } | ForEach-Object {
    try { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { '' }
  } | Where-Object { $_ })
  $expectedSids = @($currentSid.Value, $systemSid.Value)
  if (@($allowedSids | Where-Object { $_ -notin $expectedSids }).Count -gt 0 -or
      @($expectedSids | Where-Object { $_ -notin $allowedSids }).Count -gt 0) {
    throw "El ACL del directorio de reporte no coincide con la lista de identidades permitidas: $fullPath"
  }

  return $fullPath
}

Export-ModuleMember -Function 'Initialize-InstallerHubE2EReportDirectory'
