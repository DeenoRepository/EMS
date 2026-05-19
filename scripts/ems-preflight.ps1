$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$modules = @(
  @{ Name = "EPS"; Path = Join-Path $root "EPS"; DatabaseUrl = "postgresql://eps:eps@127.0.0.1:5437/eps?schema=public" },
  @{ Name = "MMS"; Path = Join-Path $root "MMS"; DatabaseUrl = "postgresql://mms:mms@127.0.0.1:5438/mms?schema=public" },
  @{ Name = "WMS"; Path = Join-Path $root "WMS"; DatabaseUrl = "postgresql://wms:wms@127.0.0.1:5436/wms?schema=public" }
)

foreach ($module in $modules) {
  if (-not (Test-Path -LiteralPath $module.Path)) {
    throw "[EMS preflight] Missing module path: $($module.Path)"
  }
}

Write-Host "[EMS preflight] Checking npm/node availability..." -ForegroundColor Cyan
node -v
npm -v

foreach ($module in $modules) {
  Write-Host "[EMS preflight] $($module.Name): package + prisma sanity" -ForegroundColor Cyan
  Push-Location $module.Path
  $env:DATABASE_URL = $module.DatabaseUrl
  npm run prisma:generate | Out-Host
  if (Test-Path -LiteralPath (Join-Path $module.Path "prisma\migrations")) {
    npx prisma migrate status | Out-Host
  } else {
    Write-Host "[EMS preflight] $($module.Name): no migrations dir, will use prisma db push in ems-up"
  }
  Pop-Location
}

Write-Host "[EMS preflight] OK" -ForegroundColor Green
