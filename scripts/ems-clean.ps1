$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$targets = @(
  (Join-Path $root "EPS\\.next"),
  (Join-Path $root "EPS\\node_modules"),
  (Join-Path $root "MMS\\.next"),
  (Join-Path $root "MMS\\node_modules"),
  (Join-Path $root "WMS\\.next"),
  (Join-Path $root "WMS\\node_modules"),
  (Join-Path $root "tmp_ppr_xlsx")
)

foreach ($target in $targets) {
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
    Write-Host "[EMS clean] removed: $target"
  } else {
    Write-Host "[EMS clean] skip: $target"
  }
}
