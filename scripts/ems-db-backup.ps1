$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $root "backups"
if (-not (Test-Path -LiteralPath $backupDir)) {
  New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$targets = @(
  @{ Name="eps"; Container="ems-eps-db-local"; Db="eps"; User="eps" },
  @{ Name="mms"; Container="ems-mms-db-local"; Db="mms"; User="mms" },
  @{ Name="wms"; Container="ems-wms-db-local"; Db="wms"; User="wms" }
)

foreach ($t in $targets) {
  $file = Join-Path $backupDir ("{0}-{1}.sql" -f $t.Name, $ts)
  Write-Host "[BACKUP] $($t.Name) -> $file" -ForegroundColor Cyan
  docker exec $t.Container pg_dump -U $t.User -d $t.Db > $file
}

Write-Host "[BACKUP] Completed." -ForegroundColor Green
