Write-Host "Running auth caps tests (demanding DEMO_MODE=true on server)..."

Write-Host "=== Test 1: Register and Verify 3 accounts on the same Device FP & Subnet ==="
for ($i=1; $i -le 3; $i++) {
    $IP = "10.0.0.1"
    Write-Host "Registering testuser$i@example.com from IP $IP..."
    $body = @{email="testuser$i@example.com"} | ConvertTo-Json -Compress
    $res = Invoke-RestMethod -Uri "http://localhost/auth/register" -Method Post -Headers @{"Content-Type"="application/json"; "X-Forwarded-For"=$IP} -Body $body
    
    $otp = $res.otp
    Write-Host "OTP: $otp"
    
    if ($otp) {
        Write-Host "Verifying testuser$i@example.com..."
        $verifyBody = @{email="testuser$i@example.com"; otp=$otp; deviceFp="fp-1"} | ConvertTo-Json
        $verifyRes = Invoke-RestMethod -Uri "http://localhost/auth/verify" -Method Post -Headers @{"Content-Type"="application/json"; "X-Forwarded-For"=$IP} -Body $verifyBody
        Write-Host ($verifyRes | ConvertTo-Json -Compress)
    }
    Write-Host "---"
}

Write-Host "=== Test 2: Register 4th account (Should get risk_tier=high) ==="
$IP = "10.0.0.2"
Write-Host "Registering testuser4@example.com from IP $IP..."
$body = @{email="testuser4@example.com"} | ConvertTo-Json -Compress
$res = Invoke-RestMethod -Uri "http://localhost/auth/register" -Method Post -Headers @{"Content-Type"="application/json"; "X-Forwarded-For"=$IP} -Body $body

$otp = $res.otp
Write-Host "OTP: $otp"

if ($otp) {
    Write-Host "Verifying testuser4@example.com..."
    $verifyBody = @{email="testuser4@example.com"; otp=$otp; deviceFp="fp-1"} | ConvertTo-Json
    $verifyRes = Invoke-RestMethod -Uri "http://localhost/auth/verify" -Method Post -Headers @{"Content-Type"="application/json"; "X-Forwarded-For"=$IP} -Body $verifyBody
    Write-Host ($verifyRes | ConvertTo-Json -Compress)
}
Write-Host "---"

Write-Host "=== Test 3: Register 5th account with different FP and different subnet (Should be normal) ==="
$IP = "10.0.1.5"
Write-Host "Registering testuser5@example.com from IP $IP..."
$body = @{email="testuser5@example.com"} | ConvertTo-Json -Compress
$res = Invoke-RestMethod -Uri "http://localhost/auth/register" -Method Post -Headers @{"Content-Type"="application/json"; "X-Forwarded-For"=$IP} -Body $body

$otp = $res.otp
Write-Host "OTP: $otp"

if ($otp) {
    Write-Host "Verifying testuser5@example.com..."
    $verifyBody = @{email="testuser5@example.com"; otp=$otp; deviceFp="fp-2"} | ConvertTo-Json
    $verifyRes = Invoke-RestMethod -Uri "http://localhost/auth/verify" -Method Post -Headers @{"Content-Type"="application/json"; "X-Forwarded-For"=$IP} -Body $verifyBody
    Write-Host ($verifyRes | ConvertTo-Json -Compress)
}
