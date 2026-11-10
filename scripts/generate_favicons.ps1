Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$crmDir = Split-Path -Parent $scriptDir
$srcPath = Join-Path $crmDir "public\leadmaster_logo_120.png"
$publicDir = Join-Path $crmDir "public"

Write-Host "Source: $srcPath"
Write-Host "Target: $publicDir"

$srcImage = [System.Drawing.Bitmap]::FromFile($srcPath)

function Resize-Bitmap($src, $w, $h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($src, 0, 0, $w, $h)
    $g.Dispose()
    return $bmp
}

$sizes = @(16, 32, 48, 64, 180, 192)
$pngBytesMap = @{}

foreach ($s in $sizes) {
    $resized = Resize-Bitmap $srcImage $s $s
    $ms = New-Object System.IO.MemoryStream
    $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytes = $ms.ToArray()
    $pngBytesMap[$s] = $pngBytes
    $ms.Dispose()
    $resized.Dispose()
}

[System.IO.File]::WriteAllBytes((Join-Path $publicDir "favicon-16x16.png"), $pngBytesMap[16])
[System.IO.File]::WriteAllBytes((Join-Path $publicDir "favicon-32x32.png"), $pngBytesMap[32])
[System.IO.File]::WriteAllBytes((Join-Path $publicDir "favicon-48x48.png"), $pngBytesMap[48])
[System.IO.File]::WriteAllBytes((Join-Path $publicDir "apple-touch-icon.png"), $pngBytesMap[180])

# Multi-resolution ICO: 16, 32, 48
$icoSizes = @(16, 32, 48)
$icoStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter $icoStream

$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$icoSizes.Count)

$offset = 6 + (16 * $icoSizes.Count)

foreach ($s in $icoSizes) {
    $bytes = $pngBytesMap[$s]
    $wByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $hByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $writer.Write($wByte)
    $writer.Write($hByte)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $bytes.Length
}

foreach ($s in $icoSizes) {
    $bytes = $pngBytesMap[$s]
    $writer.Write($bytes)
}

$icoBytes = $icoStream.ToArray()
[System.IO.File]::WriteAllBytes((Join-Path $publicDir "favicon.ico"), $icoBytes)
$writer.Dispose()
$icoStream.Dispose()
$srcImage.Dispose()

Write-Host "SUCCESS: Generated favicon.ico, favicon-16x16.png, favicon-32x32.png, favicon-48x48.png, apple-touch-icon.png"
