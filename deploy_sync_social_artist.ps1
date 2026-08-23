# Déploiement "Inscription auto Make Music -> Social Artist"
# Usage : depuis le dossier site-agenda-studio, lancer :  .\deploy_sync_social_artist.ps1
# Prérequis : npx supabase login (une fois, dans ton terminal)

$ErrorActionPreference = "Stop"
$ProjectRef = "bbdylrwiwnwjpeblxriq"
$SaUrl = "https://ivneqyuchqjgsmfrutfn.supabase.co"

# 1) Récupérer la clé service_role de Social Artist depuis son .env.local (jamais affichée)
$SaEnv = "D:\1 WORK\CODE\code social artist\social artist\social-artist\.env.local"
$SaKey = $null
if (Test-Path $SaEnv) {
  $line = Select-String -Path $SaEnv -Pattern '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=' | Select-Object -First 1
  if ($line) {
    $SaKey = ($line.Line -replace '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*', '').Trim().Trim('"').Trim("'")
  }
}

# Fallback : demander la clé si introuvable dans le fichier
if ([string]::IsNullOrWhiteSpace($SaKey)) {
  Write-Host "Cle introuvable dans .env.local — colle-la (saisie masquee) :" -ForegroundColor Yellow
  $secure = Read-Host "SOCIAL_ARTIST_SERVICE_ROLE_KEY" -AsSecureString
  $SaKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if ([string]::IsNullOrWhiteSpace($SaKey)) { Write-Host "Cle vide, abandon." -ForegroundColor Red; exit 1 }

Write-Host "`n[1/2] Configuration des secrets sur $ProjectRef ..." -ForegroundColor Green
npx supabase secrets set "SOCIAL_ARTIST_SUPABASE_URL=$SaUrl" "SOCIAL_ARTIST_SERVICE_ROLE_KEY=$SaKey" --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { Write-Host "Echec secrets set (es-tu connecte ? npx supabase login)" -ForegroundColor Red; exit 1 }

Write-Host "`n[2/2] Deploiement de la fonction..." -ForegroundColor Green
npx supabase functions deploy sync-user-to-social-artist --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { Write-Host "Echec deploy." -ForegroundColor Red; exit 1 }

Write-Host "`n✅ Termine ! Teste en t'inscrivant sur Make Music avec un email neuf." -ForegroundColor Cyan
