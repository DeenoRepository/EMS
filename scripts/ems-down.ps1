$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$infraCompose = Join-Path $root "scripts\docker-compose.infra.yml"

Write-Host "[EMS] Stopping local Next.js processes..." -ForegroundColor Yellow
$patterns = @(
  "\\EPS",
  "\\MMS",
  "\\WMS"
)

try {
  $procs = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match "node(.exe)?|npm(.cmd)?|powershell(.exe)?" -and
    $_.CommandLine -match "next dev"
  }

  foreach ($proc in $procs) {
    $match = $false
    foreach ($pattern in $patterns) {
      if ($proc.CommandLine -like "*$pattern*") {
        $match = $true
        break
      }
    }
    if ($match) {
      try {
        Stop-Process -Id $proc.ProcessId -Force
        Write-Host "[EMS] Stopped PID $($proc.ProcessId)"
      } catch {}
    }
  }
} catch {
  Write-Host "[EMS] Process scan skipped (insufficient permissions). Continuing..." -ForegroundColor Yellow
}

Write-Host "[EMS] Stopping infrastructure (PostgreSQL + LDAP)..." -ForegroundColor Yellow
docker compose -f $infraCompose down

Write-Host "[EMS] Done." -ForegroundColor Green
