# Script to run E2E tests 3 times and collect results
# Usage: .\tests\e2e\run-tests-3x.ps1

$ErrorActionPreference = "Continue"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "E2E Tests - 3x Run" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$results = @()

for ($i = 1; $i -le 3; $i++) {
    Write-Host "`n--- Run $i/3 ---" -ForegroundColor Yellow
    
    $startTime = Get-Date
    
    # Run tests
    npm run test:e2e -- --project=calendar-e2e tests/e2e/calendar-suite/createLesson.spec.ts
    
    $exitCode = $LASTEXITCODE
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    $result = @{
        Run = $i
        ExitCode = $exitCode
        Duration = [math]::Round($duration, 2)
        Status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
        Timestamp = $startTime.ToString("yyyy-MM-dd HH:mm:ss")
    }
    
    $results += New-Object PSObject -Property $result
    
    if ($exitCode -ne 0) {
        Write-Host "`n❌ Run $i FAILED (exit code: $exitCode)" -ForegroundColor Red
    } else {
        Write-Host "`n✅ Run $i PASSED" -ForegroundColor Green
    }
    
    # Wait between runs
    if ($i -lt 3) {
        Write-Host "Waiting 2 seconds before next run..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$results | Format-Table -Property Run, Status, ExitCode, Duration, Timestamp -AutoSize

$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count

Write-Host "`nTotal: $passCount passed, $failCount failed" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Yellow" })

if ($failCount -eq 0) {
    Write-Host "`n🎉 All 3 runs PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️  Some runs failed. Check logs above." -ForegroundColor Yellow
    exit 1
}
