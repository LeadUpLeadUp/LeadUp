# הרצה חד-פעמית: מעתיק את תמונת הגיבור לתיקיית assets
$src = Join-Path $PSScriptRoot "..\Users\סומך\.cursor\projects\empty-window\assets\arie-hero.png"
if (-not (Test-Path $src)) {
  $src = "C:\Users\סומך\.cursor\projects\empty-window\assets\arie-hero.png"
}
$destDir = Join-Path $PSScriptRoot "assets"
$dest = Join-Path $destDir "arie-hero.png"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item -LiteralPath $src -Destination $dest -Force
Write-Host "Copied to $dest"
