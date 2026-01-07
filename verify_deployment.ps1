$Url = "https://script.google.com/macros/s/AKfycbw0fM3P6oa2eL9aJorCsbS3sNyRZ8hzBzGccOvoJNGTXgy-Wdo1rhxUkgqyPkRty8HUlg/exec"

# 1. Regression Check (Get Leads)
Write-Host "Checking 'leads' target (Regression Test)..."
try {
    $leadsResponse = Invoke-RestMethod -Uri "$Url?target=leads" -Method Get
    if ($leadsResponse -is [Array]) {
        Write-Host "SUCCESS: Leads endpoint returned an array." -ForegroundColor Green
    }
    else {
        Write-Host "WARNING: Leads endpoint returned unexpected type." -ForegroundColor Yellow
        Write-Host $leadsResponse
    }
}
catch {
    Write-Host "ERROR: Leads endpoint failed. $($_.Exception.Message)" -ForegroundColor Red
}

echo "`n--------------------------------`n"

# 2. New Feature Check (Upload)
Write-Host "Checking 'upload' target (New Feature Test)..."
$Payload = @{
    target   = "upload"
    filename = "deployment_verify.txt"
    mimeType = "text/plain"
    data     = "VGVzdCBVcGxvYWQgVmVyaWZpY2F0aW9u" # "Test Upload Verification" in Base64
} | ConvertTo-Json

try {
    # GAS typically requires following redirects for POST, but Invoke-RestMethod handles it by default usually.
    # However, GAS web apps redirect to a content serving URL.
    $uploadResponse = Invoke-RestMethod -Uri $Url -Method Post -Body $Payload -ContentType 'application/json'
    
    if ($uploadResponse.status -eq 'success' -and $uploadResponse.url) {
        Write-Host "SUCCESS: Upload endpoint works!" -ForegroundColor Green
        Write-Host "File URL: $($uploadResponse.url)"
    }
    else {
        Write-Host "FAILURE: Upload endpoint response incorrect." -ForegroundColor Red
        Write-Host ($uploadResponse | ConvertTo-Json -Depth 5)
    }
}
catch {
    Write-Host "ERROR: Upload endpoint request failed. $($_.Exception.Message)" -ForegroundColor Red
    # Try to print response stream if available
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
    catch {}
}
