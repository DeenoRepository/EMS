param(
  [switch]$SkipInstall,
  [int]$InfraTimeoutSec = 180,
  [int]$StepTimeoutSec = 900,
  [int]$HealthTimeoutSec = 180
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$infraCompose = Join-Path $root "scripts\docker-compose.infra.yml"
$localEnvFile = Join-Path $root ".env.ems.local"
$npmCmd = if (Test-Path "C:\Program Files\nodejs\npm.cmd") { "C:\Program Files\nodejs\npm.cmd" } else { "npm" }
if ($env:Path -notlike "*C:\Program Files\nodejs*") {
  $env:Path = "C:\Program Files\nodejs;$($env:Path)"
}

function Load-EnvFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim().Trim('"')
    Set-Item -Path ("Env:\" + $name) -Value $value
  }
}

function Wait-ForPort {
  param(
    [string]$TargetHost,
    [int]$Port,
    [int]$TimeoutSec = 120
  )
  $started = Get-Date
  while (((Get-Date) - $started).TotalSeconds -lt $TimeoutSec) {
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
      if ($iar.AsyncWaitHandle.WaitOne(800) -and $client.Connected) {
        $client.EndConnect($iar)
        $client.Close()
        return $true
      }
      $client.Close()
    } catch {}
    Start-Sleep -Milliseconds 800
  }
  return $false
}

function Invoke-Step {
  param(
    [string]$Title,
    [string]$Cwd,
    [string]$Command,
    [int]$TimeoutSec = 300
  )
  Write-Host "[EMS] $Title" -ForegroundColor Cyan
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "powershell"
  $psi.Arguments = "-NoProfile -Command $Command"
  $psi.WorkingDirectory = $Cwd
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.EnvironmentVariables["Path"] = "C:\Program Files\nodejs;" + $psi.EnvironmentVariables["Path"]
  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  [void]$proc.Start()
  $started = Get-Date
  while (-not $proc.HasExited) {
    $elapsed = [int]((Get-Date) - $started).TotalSeconds
    if (($elapsed % 20) -eq 0) {
      Write-Host "[EMS] $Title ... ${elapsed}s" -ForegroundColor DarkGray
    }
    if ($elapsed -ge $TimeoutSec) {
      try { $proc.Kill() } catch {}
      throw "[EMS] timeout on step: $Title"
    }
    Start-Sleep -Seconds 1
  }
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  if ($stdout) { Write-Host $stdout }
  if ($stderr) { Write-Host $stderr -ForegroundColor Yellow }
  if ($proc.ExitCode -ne 0) {
    throw "[EMS] failed step: $Title (exit $($proc.ExitCode))"
  }
}

function Invoke-PrismaGenerateSafe {
  param(
    [string]$ModuleName,
    [string]$ModulePath
  )
  try {
    Invoke-Step -Title "${ModuleName}: prisma generate" -Cwd $ModulePath -Command "& '$npmCmd' run prisma:generate" -TimeoutSec 240
    return
  } catch {
    $msg = $_.Exception.Message
    if ($msg -notmatch "EPERM|operation not permitted|failed step") { throw }
  }

  Write-Host "[EMS] ${ModuleName}: prisma generate retry after cleanup (.prisma/client)..." -ForegroundColor Yellow
  $clientDir = Join-Path $ModulePath "node_modules\.prisma\client"
  if (Test-Path -LiteralPath $clientDir) {
    try { Remove-Item -LiteralPath $clientDir -Recurse -Force } catch {}
  }

  # Stop stale local node processes that may hold the engine DLL lock.
  Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match "node(.exe)?" -and $_.CommandLine -like "*$ModulePath*"
  } | ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force } catch {}
  }

  Start-Sleep -Seconds 2
  Invoke-Step -Title "${ModuleName}: prisma generate (retry)" -Cwd $ModulePath -Command "& '$npmCmd' run prisma:generate" -TimeoutSec 240
}

function Stop-PrismaEngineLocks {
  param([string]$ModulePath)
  Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match "node(.exe)?|schema-engine-windows.exe|query-engine-windows.dll.node" -and
    ($_.CommandLine -like "*$ModulePath*" -or $_.Name -match "schema-engine-windows.exe")
  } | ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force } catch {}
  }
}

function Invoke-PrismaMigrateSafe {
  param(
    [string]$ModuleName,
    [string]$ModulePath,
    [bool]$HasMigrations
  )

  if (-not $HasMigrations) {
    Invoke-Step -Title "$($ModuleName): prisma db push (no migrations dir)" -Cwd $ModulePath -Command "npx prisma db push" -TimeoutSec 300
    return
  }

  try {
    Invoke-Step -Title "$($ModuleName): prisma migrate deploy" -Cwd $ModulePath -Command "& '$npmCmd' run prisma:migrate:deploy" -TimeoutSec 300
    return
  } catch {
    $msg = $_.Exception.Message
    if ($msg -notmatch "EPERM|operation not permitted|failed step") { throw }
  }

  Write-Host "[EMS] ${ModuleName}: prisma migrate deploy retry after engine lock cleanup..." -ForegroundColor Yellow
  Stop-PrismaEngineLocks -ModulePath $ModulePath
  Start-Sleep -Seconds 2
  Invoke-Step -Title "$($ModuleName): prisma migrate deploy (retry)" -Cwd $ModulePath -Command "& '$npmCmd' run prisma:migrate:deploy" -TimeoutSec 300
}

function Wait-ForHealth {
  param(
    [string]$Name,
    [string]$Url,
    [int]$TimeoutSec = 120
  )
  $started = Get-Date
  while (((Get-Date) - $started).TotalSeconds -lt $TimeoutSec) {
    try {
      $res = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 5
      if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500) {
        Write-Host "[EMS] $Name health OK ($($res.StatusCode))" -ForegroundColor Green
        return $true
      }
    } catch {}
    Start-Sleep -Milliseconds 1200
  }
  return $false
}

Load-EnvFile -Path $localEnvFile

Write-Host "[EMS] Starting infrastructure (PostgreSQL + LDAP)..." -ForegroundColor Cyan
docker compose -f $infraCompose up -d

$checks = @(
  @{ Name = "EPS PostgreSQL"; Host = "127.0.0.1"; Port = 5437; Container = "ems-eps-db-local" },
  @{ Name = "MMS PostgreSQL"; Host = "127.0.0.1"; Port = 5438; Container = "ems-mms-db-local" },
  @{ Name = "WMS PostgreSQL"; Host = "127.0.0.1"; Port = 5436; Container = "ems-wms-db-local" },
  @{ Name = "LDAP"; Host = "127.0.0.1"; Port = 3890; Container = "ems-ldap-local" }
)

foreach ($check in $checks) {
  Write-Host ("[EMS] Waiting for {0} on {1}:{2}" -f $check.Name, $check.Host, $check.Port)
  if (-not (Wait-ForPort -TargetHost $check.Host -Port $check.Port -TimeoutSec $InfraTimeoutSec)) {
    docker compose -f $infraCompose ps
    if ($check.Container) { docker logs $check.Container --tail=120 }
    throw "[EMS] $($check.Name) is not ready"
  }
}

$ldapSeedScript = Join-Path $root "scripts\ems-ldap-seed.ps1"
if (Test-Path -LiteralPath $ldapSeedScript) {
  $seedAdminPass = if ($env:EMS_LDAP_ADMIN_PASSWORD) { $env:EMS_LDAP_ADMIN_PASSWORD } else { "admin" }
  $seedUserAdminPass = if ($env:EMS_LDAP_USER_ADMIN_PASSWORD) { $env:EMS_LDAP_USER_ADMIN_PASSWORD } else { "admin123" }
  $seedUserEditorPass = if ($env:EMS_LDAP_USER_EDITOR_PASSWORD) { $env:EMS_LDAP_USER_EDITOR_PASSWORD } else { "editor123" }
  $seedUserViewerPass = if ($env:EMS_LDAP_USER_VIEWER_PASSWORD) { $env:EMS_LDAP_USER_VIEWER_PASSWORD } else { "viewer123" }
  Invoke-Step -Title "LDAP seed" -Cwd $root -Command "powershell -ExecutionPolicy Bypass -File .\scripts\ems-ldap-seed.ps1 -AdminPassword '$seedAdminPass' -AdminUserPassword '$seedUserAdminPass' -EditorUserPassword '$seedUserEditorPass' -ViewerUserPassword '$seedUserViewerPass'" -TimeoutSec 120
}

$ldapAdminPassword = if ($env:EMS_LDAP_ADMIN_PASSWORD) { $env:EMS_LDAP_ADMIN_PASSWORD } else { "admin" }
$ldapUsersAdminPassword = if ($env:EMS_LDAP_USER_ADMIN_PASSWORD) { $env:EMS_LDAP_USER_ADMIN_PASSWORD } else { "admin123" }

$modules = @(
  @{
    Name = "EPS"
    Path = Join-Path $root "EPS"
    Port = 3210
    DatabaseUrl = "postgresql://eps:eps@127.0.0.1:5437/eps?schema=public"
    HealthUrl = "http://127.0.0.1:3210/api/health"
    ExtraEnv = @{
      AUTH_PROVIDER = "ldap"
      NEXT_PUBLIC_AUTH_PROVIDER = "ldap"
      ENABLE_DEBUG_AUTH_ROUTES = "false"
      NEXT_PUBLIC_ENABLE_DEBUG_AUTH_ROUTES = "false"
      NEXT_PUBLIC_ENABLE_LDAP_DEBUG = "false"
      LDAP_URL = "ldap://127.0.0.1:3890"
      LDAP_BASE_DN = "dc=ems,dc=local"
      LDAP_USER_BASE_DN = "ou=people,dc=ems,dc=local"
      LDAP_GROUP_BASE_DN = "ou=groups,dc=ems,dc=local"
      LDAP_DIRECT_BIND = "false"
      LDAP_BIND_DN = "cn=admin,dc=ems,dc=local"
      LDAP_BIND_PASSWORD = $ldapAdminPassword
    }
  },
    @{
      Name = "MMS"
      Path = Join-Path $root "MMS"
      Port = 3201
      DatabaseUrl = "postgresql://mms:mms@127.0.0.1:5438/mms?schema=public"
      HealthUrl = "http://127.0.0.1:3201/api/health"
      ExtraEnv = @{
        AUTH_PROVIDER = "ldap"
        NEXT_PUBLIC_AUTH_PROVIDER = "ldap"
        EPS_API_BASE_URL = "http://127.0.0.1:3210/api"
      LDAP_URL = "ldap://127.0.0.1:3890"
      LDAP_BASE_DN = "dc=ems,dc=local"
      LDAP_USER_BASE_DN = "ou=people,dc=ems,dc=local"
      LDAP_GROUP_BASE_DN = "ou=groups,dc=ems,dc=local"
      LDAP_DIRECT_BIND = "false"
      LDAP_BIND_DN = "cn=admin,dc=ems,dc=local"
      LDAP_BIND_PASSWORD = $ldapAdminPassword
    }
  },
    @{
      Name = "WMS"
      Path = Join-Path $root "WMS"
      Port = 3202
      DatabaseUrl = "postgresql://wms:wms@127.0.0.1:5436/wms?schema=public"
      HealthUrl = "http://127.0.0.1:3202/api/health"
      ExtraEnv = @{
        AUTH_PROVIDER = "ldap"
        NEXT_PUBLIC_AUTH_PROVIDER = "ldap"
        EPS_API_BASE_URL = "http://127.0.0.1:3210/api"
      MMS_API_BASE_URL = "http://127.0.0.1:3201/api"
      ALLOWED_ORIGINS = "http://localhost:3202,http://127.0.0.1:3202"
      WRITE_RATE_USE_DB = "true"
      LDAP_URL = "ldap://127.0.0.1:3890"
      LDAP_BASE_DN = "dc=ems,dc=local"
      LDAP_USER_BASE_DN = "ou=people,dc=ems,dc=local"
      LDAP_GROUP_BASE_DN = "ou=groups,dc=ems,dc=local"
      LDAP_DIRECT_BIND = "false"
      LDAP_BIND_DN = "cn=admin,dc=ems,dc=local"
      LDAP_BIND_PASSWORD = $ldapAdminPassword
    }
  }
)

foreach ($module in $modules) {
  if (-not (Test-Path -LiteralPath $module.Path)) {
    throw "[EMS] Module path not found: $($module.Path)"
  }
}

foreach ($module in $modules) {
  $env:DATABASE_URL = $module.DatabaseUrl
  $env:PORT = [string]$module.Port
  foreach ($key in $module.ExtraEnv.Keys) {
    Set-Item -Path ("Env:\" + $key) -Value $module.ExtraEnv[$key]
  }

  if (-not $SkipInstall) {
    Invoke-Step -Title "$($module.Name): npm install" -Cwd $module.Path -Command "& '$npmCmd' install" -TimeoutSec $StepTimeoutSec
  }
  Invoke-PrismaGenerateSafe -ModuleName $module.Name -ModulePath $module.Path

  $migrationsDir = Join-Path $module.Path "prisma\migrations"
  Invoke-PrismaMigrateSafe -ModuleName $module.Name -ModulePath $module.Path -HasMigrations (Test-Path -LiteralPath $migrationsDir)
}

Write-Host "[EMS] Starting EPS, MMS, WMS..." -ForegroundColor Green
foreach ($module in $modules) {
  $env:PORT = [string]$module.Port
  $env:DATABASE_URL = $module.DatabaseUrl
  foreach ($key in $module.ExtraEnv.Keys) {
    Set-Item -Path ("Env:\" + $key) -Value $module.ExtraEnv[$key]
  }

  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$($module.Path)'; & '$npmCmd' run dev -- --webpack --hostname 0.0.0.0 --port $($module.Port)"
  ) | Out-Null
}

Start-Sleep -Seconds 4
foreach ($module in $modules) {
  if (-not (Wait-ForHealth -Name $module.Name -Url $module.HealthUrl -TimeoutSec $HealthTimeoutSec)) {
    throw "[EMS] $($module.Name) health endpoint did not respond: $($module.HealthUrl)"
  }
}

Write-Host "[EMS] Services started and healthy." -ForegroundColor Green
Write-Host "[EMS] EPS: http://localhost:3100"
Write-Host "[EMS] MMS: http://localhost:3201"
Write-Host "[EMS] WMS: http://localhost:3202"
Write-Host "[EMS] LDAP: ldap://localhost:3890 (cn=admin,dc=ems,dc=local / $ldapAdminPassword)"
Write-Host "[EMS] Test users: admin/$ldapUsersAdminPassword, editor/editor123, viewer/viewer123"
