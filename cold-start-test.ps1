param([int]$Runs = 3)
$root = $PSScriptRoot
if (-not $root) { throw 'Save this file first and run it with: powershell -ExecutionPolicy Bypass -File .\cold-start-test.ps1' }
Set-Location $root
$c = '-f', 'docker-compose.yml', '-f', 'docker-compose.dev-ports.yml'

for ($i = 1; $i -le $Runs; $i++) {
  Write-Host "=== Cold start $i of $Runs ==="
  docker compose @c down 2>&1 | Out-Null

  $upLines = docker compose --progress plain @c up -d 2>&1 | ForEach-Object { "$_" }
  $upCode = $LASTEXITCODE
  $upLines | Select-String 'dependency failed|unhealthy|Error' | ForEach-Object { Write-Host "  UP: $($_.Line)" }

  Start-Sleep -Seconds 45
  $status = docker compose @c ps --format '{{.Service}}|{{.Status}}'
  $healthy = @($status | Where-Object { $_ -match '\(healthy\)' }).Count
  Write-Host "  up exit code: $upCode | healthy services: $healthy of 13"
  $status | Where-Object { $_ -notmatch '\(healthy\)' } | ForEach-Object { Write-Host "  NOT HEALTHY: $_" }

  $restarts = docker compose @c ps -q | ForEach-Object { docker inspect --format '{{.Name}} restarts={{.RestartCount}}' $_ } | Where-Object { $_ -notmatch 'restarts=0' }
  if ($restarts) { $restarts | ForEach-Object { Write-Host "  RESTARTED: $_" } } else { Write-Host '  no container restarted' }

  $waits = docker compose @c logs customer-service shipment-service 2>&1 | ForEach-Object { "$_" } | Select-String 'not ready|failed to start|Crash'
  if ($waits) { $waits | Select-Object -First 6 | ForEach-Object { Write-Host "  LOG: $($_.Line)" } } else { Write-Host '  no Kafka wait or crash messages' }
}
