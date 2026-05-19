param(
  [Parameter(Mandatory = $true)][ValidateSet("eps","mms","wms")] [string]$Target,
  [Parameter(Mandatory = $true)][string]$FilePath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "Backup file not found: $FilePath"
}

$cfg = switch ($Target) {
  "eps" { @{ Container="ems-eps-db-local"; Db="eps"; User="eps" } }
  "mms" { @{ Container="ems-mms-db-local"; Db="mms"; User="mms" } }
  "wms" { @{ Container="ems-wms-db-local"; Db="wms"; User="wms" } }
}

Write-Host "[RESTORE] Target=$Target from $FilePath" -ForegroundColor Yellow
Get-Content -LiteralPath $FilePath | docker exec -i $cfg.Container psql -U $cfg.User -d $cfg.Db
Write-Host "[RESTORE] Completed." -ForegroundColor Green
