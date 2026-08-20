$text = Get-Content 'E:\Open code project\ai video editor\src\engine\storage\thumbnails.ts' -Raw
$braces = $text -replace '[^{}]', ''
$open = 0
$i = 0
$chars = $braces.ToCharArray()
foreach ($c in $chars) {
    if ($c -eq '{') { $open++ } else { $open-- }
    if ($open -lt 0) { Write-Host "Negative at $i"; break }
    $i++
}
Write-Host "Final open: $open"