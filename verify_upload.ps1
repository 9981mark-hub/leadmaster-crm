$Url = "https://script.google.com/macros/s/AKfycbyv68G12Kd0g8RThZGpXToV2m_PjN7IsaBXwzDkPvA1TqsgFTIjQFuuC0G0_Xitsxm8/exec"
$Body = @{
    target   = "upload"
    filename = "test.txt"
    mimeType = "text/plain"
    data     = "SGVsbG8="
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri $Url -Method Post -Body $Body -ContentType 'application/json'
    Write-Host "STATUS: $($res.status)"
    Write-Host "MESSAGE: $($res.message)"
    Write-Host "FULL: $($res | ConvertTo-Json -Depth 5)"
}
catch {
    Write-Host "HTTP ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "BODY: $($reader.ReadToEnd())"
    }
}
