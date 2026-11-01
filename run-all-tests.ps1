$root = $PSScriptRoot
if (-not $root) {
  throw 'This file must be saved and run with: powershell -ExecutionPolicy Bypass -File .\run-all-tests.ps1'
}

$suites = @(
  @{ Name = 'auth';     Dir = 'services\auth-service';     Args = '' },
  @{ Name = 'customer'; Dir = 'services\customer-service'; Args = '' },
  @{ Name = 'product';  Dir = 'services\product-service';  Args = '' },
  @{ Name = 'order';    Dir = 'services\order-service';    Args = '' },
  @{ Name = 'shipment'; Dir = 'services\shipment-service'; Args = '--e2e' },
  @{ Name = 'gateway';  Dir = 'api-gateway';               Args = '' }
)

$results = @()
foreach ($s in $suites) {
  Write-Host "Running $($s.Name)..."
  Push-Location (Join-Path $root $s.Dir)
  $out = cmd /c "node scripts\smoke-test.js $($s.Args) 2>&1" | Out-String
  $code = $LASTEXITCODE
  Pop-Location

  $pass = ([regex]::Matches($out, '(?m)^PASS')).Count
  $fail = ([regex]::Matches($out, '(?m)^FAIL')).Count
  $results += [pscustomobject]@{ Suite = $s.Name; Pass = $pass; Fail = $fail; ExitCode = $code }

  foreach ($line in ($out -split "`r?`n")) {
    if ($line -match '^FAIL') { Write-Host "  $line" }
  }
  if ($code -ne 0 -and $fail -eq 0) {
    Write-Host '  (crashed, last lines:)'
    ($out -split "`r?`n" | Select-Object -Last 6) | ForEach-Object { Write-Host "  $_" }
  }
}
$results | Format-Table -AutoSize
$total = ($results | Measure-Object -Property Pass -Sum).Sum
Write-Host "Total PASS: $total"
