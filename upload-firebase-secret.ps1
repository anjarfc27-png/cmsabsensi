# Script to upload Firebase Service Account to Supabase
# Run this script in PowerShell

Write-Host "Reading Firebase Service Account JSON..." -ForegroundColor Cyan
$jsonContent = Get-Content ".firebase-service-account.json" -Raw

Write-Host "Minifying JSON..." -ForegroundColor Cyan
$minified = ($jsonContent | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 10)

Write-Host "Uploading to Supabase..." -ForegroundColor Cyan
Write-Host "Command: supabase secrets set `"FIREBASE_SERVICE_ACCOUNT=$minified`"" -ForegroundColor Yellow

# Execute the command
$env:FIREBASE_SERVICE_ACCOUNT = $minified
supabase secrets set "FIREBASE_SERVICE_ACCOUNT=$minified"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ SUCCESS! Secret uploaded successfully!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Wait 10-30 seconds for the secret to propagate"
    Write-Host "2. Test the notification again in your app"
} else {
    Write-Host "`n❌ FAILED! Please try manual upload via Dashboard:" -ForegroundColor Red
    Write-Host "https://supabase.com/dashboard/project/hqyswizxciwkkvqpbzbp/settings/vault" -ForegroundColor Yellow
    Write-Host "`nMinified JSON (copy this):" -ForegroundColor Cyan
    Write-Host $minified
}
