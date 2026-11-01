$root = $PSScriptRoot
if (-not $root) { throw 'Save this file first and run it with: powershell -ExecutionPolicy Bypass -File .\generate-test-report.ps1' }

$suites = @(
  @{ Name = 'auth';     Dir = 'services\auth-service';     Args = '' },
  @{ Name = 'customer'; Dir = 'services\customer-service'; Args = '' },
  @{ Name = 'product';  Dir = 'services\product-service';  Args = '' },
  @{ Name = 'order';    Dir = 'services\order-service';    Args = '' },
  @{ Name = 'shipment'; Dir = 'services\shipment-service'; Args = '--e2e' },
  @{ Name = 'gateway';  Dir = 'api-gateway';               Args = '' }
)

# Each test case lists evidence as 'suite:label prefix'. A test case passes only if every
# evidence entry matches at least one check and all matching checks passed.
$tcs = @(
  @{ Id = 'TC-IAM-01'; Ctx = 'Identity & Access'; Title = 'Đăng ký tài khoản hợp lệ'; Ev = @('gateway:TC-IAM-01 register', 'auth:register ok') },
  @{ Id = 'TC-IAM-02'; Ctx = 'Identity & Access'; Title = 'Đăng ký username đã tồn tại'; Ev = @('gateway:duplicate username -> 409', 'auth:duplicate -> ALREADY_EXISTS') },
  @{ Id = 'TC-IAM-03'; Ctx = 'Identity & Access'; Title = 'Đăng ký thiếu password'; Ev = @('gateway:TC-IAM-03 empty password -> 400') },
  @{ Id = 'TC-IAM-04'; Ctx = 'Identity & Access'; Title = 'Đăng nhập đúng thông tin'; Ev = @('gateway:login ok with camelCase fields', 'auth:login ok') },
  @{ Id = 'TC-IAM-05'; Ctx = 'Identity & Access'; Title = 'Đăng nhập sai password'; Ev = @('gateway:wrong password -> 401', 'auth:wrong password -> UNAUTHENTICATED') },
  @{ Id = 'TC-CUS-01'; Ctx = 'Customer & Membership'; Title = 'Lấy Customer tồn tại'; Ev = @('gateway:TC-CUS-01', 'customer:TC-CUS-01') },
  @{ Id = 'TC-CUS-02'; Ctx = 'Customer & Membership'; Title = 'Lấy Customer không tồn tại'; Ev = @('gateway:TC-CUS-02', 'customer:TC-CUS-02') },
  @{ Id = 'TC-CUS-03'; Ctx = 'Customer & Membership'; Title = 'Cập nhật fullname'; Ev = @('gateway:TC-CUS-03', 'customer:TC-CUS-03') },
  @{ Id = 'TC-CUS-04'; Ctx = 'Customer & Membership'; Title = 'Lấy thông tin Membership'; Ev = @('gateway:TC-CUS-04', 'customer:TC-CUS-04') },
  @{ Id = 'TC-CUS-05'; Ctx = 'Customer & Membership'; Title = 'Truy vấn Customer không có token'; Ev = @('gateway:TC-CUS-05') },
  @{ Id = 'TC-PRO-01'; Ctx = 'Product'; Title = 'Lấy danh sách Product'; Ev = @('gateway:member lists products', 'product:TC-PRO-01') },
  @{ Id = 'TC-PRO-02'; Ctx = 'Product'; Title = 'Lấy Product tồn tại'; Ev = @('gateway:get product by id', 'product:TC-PRO-02') },
  @{ Id = 'TC-PRO-03'; Ctx = 'Product'; Title = 'Lấy Product không tồn tại'; Ev = @('gateway:unknown product -> 404', 'product:TC-PRO-03') },
  @{ Id = 'TC-PRO-04'; Ctx = 'Product'; Title = 'Tạo Product'; Ev = @('gateway:admin creates product -> 201', 'product:create product') },
  @{ Id = 'TC-PRO-05'; Ctx = 'Product'; Title = 'Cập nhật tồn kho'; Ev = @('gateway:TC-PRO-05', 'product:TC-PRO-05') },
  @{ Id = 'TC-ORD-01'; Ctx = 'Order'; Title = 'Tạo Order hợp lệ'; Ev = @('gateway:TC-ORD-01', 'order:TC-ORD-01') },
  @{ Id = 'TC-ORD-02'; Ctx = 'Order'; Title = 'Tạo Order không có JWT'; Ev = @('gateway:create order without token -> 401') },
  @{ Id = 'TC-ORD-03'; Ctx = 'Order'; Title = 'Đặt số lượng vượt tồn kho'; Ev = @('gateway:TC-ORD-03', 'order:TC-ORD-03') },
  @{ Id = 'TC-ORD-04'; Ctx = 'Order'; Title = 'Tính discount theo score'; Ev = @('gateway:TC-ORD-04', 'order:TC-ORD-04') },
  @{ Id = 'TC-ORD-05'; Ctx = 'Order'; Title = 'Tạo Order và phát sự kiện'; Ev = @('order:TC-ORD-05', 'order:outbox event published') },
  @{ Id = 'TC-SHP-01'; Ctx = 'Shipment'; Title = 'Nhận OrderCreated Event'; Ev = @('shipment:TC-SHP-01', 'shipment:e2e: Order -> Outbox') },
  @{ Id = 'TC-SHP-02'; Ctx = 'Shipment'; Title = 'Event thiếu oid'; Ev = @('shipment:TC-SHP-02', 'shipment:invalid events created no shipment') },
  @{ Id = 'TC-SHP-03'; Ctx = 'Shipment'; Title = 'Cập nhật trạng thái Shipment'; Ev = @('shipment:TC-SHP-03', 'gateway:TC-SHP-03') },
  @{ Id = 'TC-SHP-04'; Ctx = 'Shipment'; Title = 'Cập nhật Shipment không tồn tại'; Ev = @('shipment:TC-SHP-04', 'gateway:TC-SHP-04') },
  @{ Id = 'TC-SHP-05'; Ctx = 'Shipment'; Title = 'Nhận cùng Event hai lần'; Ev = @('shipment:TC-SHP-05') }
)

$labels = @{}
$summary = @()
foreach ($s in $suites) {
  Write-Host "Running $($s.Name)..."
  Push-Location (Join-Path $root $s.Dir)
  $out = cmd /c "node scripts\smoke-test.js $($s.Args) 2>&1" | Out-String
  $code = $LASTEXITCODE
  Pop-Location
  $rows = @()
  foreach ($line in ($out -split "`r?`n")) {
    if ($line -match '^(PASS|FAIL)  (.*)$') { $rows += [pscustomobject]@{ Status = $Matches[1]; Label = $Matches[2].Trim() } }
  }
  $labels[$s.Name] = $rows
  $pass = @($rows | Where-Object { $_.Status -eq 'PASS' }).Count
  $fail = @($rows | Where-Object { $_.Status -eq 'FAIL' }).Count
  $summary += [pscustomobject]@{ Suite = $s.Name; Pass = $pass; Fail = $fail; ExitCode = $code }
}

$tcLines = @()
$tcPass = 0
foreach ($tc in $tcs) {
  $ok = $true
  $evidence = @()
  foreach ($e in $tc.Ev) {
    $i = $e.IndexOf(':')
    $suite = $e.Substring(0, $i)
    $prefix = $e.Substring($i + 1)
    $found = @($labels[$suite] | Where-Object { $_.Label.StartsWith($prefix) })
    if ($found.Count -eq 0) { $ok = $false; $evidence += "${suite}: MISSING" }
    elseif (@($found | Where-Object { $_.Status -eq 'FAIL' }).Count -gt 0) { $ok = $false; $evidence += "${suite}: FAIL" }
    else { $evidence += "${suite}: $($found.Count) check(s)" }
  }
  if ($ok) { $tcPass++ }
  $result = if ($ok) { 'PASS' } else { 'FAIL' }
  $tcLines += "| $($tc.Id) | $($tc.Ctx) | $($tc.Title) | $($evidence -join '; ') | $result |"
}

$totalPass = ($summary | Measure-Object -Property Pass -Sum).Sum
$totalFail = ($summary | Measure-Object -Property Fail -Sum).Sum

$md = @()
$md += '# Test report'
$md += ''
$md += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$md += ''
$md += 'Produced by `generate-test-report.ps1`: it runs the six smoke-test suites against the running system and maps their checks to the 25 test cases of the specification.'
$md += ''
$md += "## Result: $tcPass of $($tcs.Count) test cases passed"
$md += ''
$md += '| Test case | Bounded context | Description | Evidence (suite: number of checks) | Result |'
$md += '|---|---|---|---|---|'
$md += $tcLines
$md += ''
$md += '## Automated suites'
$md += ''
$md += '| Suite | Passed | Failed | Exit code |'
$md += '|---|---|---|---|'
foreach ($r in $summary) { $md += "| $($r.Suite) | $($r.Pass) | $($r.Fail) | $($r.ExitCode) |" }
$md += "| **Total** | **$totalPass** | **$totalFail** | |"
Set-Content -Path (Join-Path $root 'docs\test-report.md') -Value $md -Encoding utf8

$summary | Format-Table -AutoSize
Write-Host "Test cases passed: $tcPass of $($tcs.Count)   Checks passed: $totalPass   Failed: $totalFail"
Write-Host 'Report written to docs\test-report.md'
if ($tcPass -ne $tcs.Count -or $totalFail -ne 0) { exit 1 }
