$ErrorActionPreference = "Stop"

function Check-Url {
  param([string]$Name, [string]$Url)
  try {
    $res = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 5
    Write-Host ("[HEALTH] {0}: {1}" -f $Name, $res.StatusCode) -ForegroundColor Green
    return $true
  } catch {
    Write-Host ("[HEALTH] {0}: FAIL ({1})" -f $Name, $_.Exception.Message) -ForegroundColor Red
    return $false
  }
}

$all = $true
$all = (Check-Url "EPS /api/health" "http://127.0.0.1:3100/api/health") -and $all
$all = (Check-Url "MMS /api/health" "http://127.0.0.1:3201/api/health") -and $all
$all = (Check-Url "WMS /api/health" "http://127.0.0.1:3202/api/health") -and $all
try { $all = (Check-Url "WMS /api/ready" "http://127.0.0.1:3202/api/ready") -and $all } catch {}

if (-not $all) {
  exit 1
}

Write-Host "[HEALTH] All checks passed." -ForegroundColor Green

