$files = @(
  'C:\Program Files\EvaluaPro\scripts\create-shortcuts.ps1',
  'C:\Program Files\EvaluaPro\scripts\generate-installation-manifest.ps1'
)
$result = foreach ($f in $files) {
  $raw = if (Test-Path -LiteralPath $f) { Get-Content -LiteralPath $f -Raw -Encoding utf8 } else { '' }
  [pscustomobject]@{
    path = $f
    hasResolveInstalledShortcutIconPath = $raw.Contains('Resolve-InstalledShortcutIconPath')
    hasRemoveLegacyShortcutIcons = $raw.Contains('Remove-LegacyShortcutIcons')
    hasInstallerCanonicalIcon = $raw.Contains('installer-canonical.ico')
    hasDashboardHub = $raw.Contains('dashboard-hub.ico')
    hasSaveIco = $raw.Contains('Save-IcoFromPngImages')
    hasNewMultiSizeIcon = $raw.Contains('New-MultiSizeIcon')
  }
}
$result | ConvertTo-Json -Compress -Depth 4
