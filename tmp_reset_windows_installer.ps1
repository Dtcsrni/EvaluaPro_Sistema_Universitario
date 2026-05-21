Get-Process msiexec -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$svc = Get-Service msiserver -ErrorAction SilentlyContinue
if ($svc) {
  if ($svc.Status -eq 'Running') {
    Stop-Service msiserver -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  Start-Service msiserver -ErrorAction SilentlyContinue
}
[pscustomobject]@{
  msiexecRunning = @((Get-Process msiexec -ErrorAction SilentlyContinue)).Count
  msiserverStatus = (Get-Service msiserver -ErrorAction SilentlyContinue).Status
} | ConvertTo-Json -Compress
