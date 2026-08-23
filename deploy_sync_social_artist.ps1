# Déploiement "Inscription auto Make Music -> Social Artist"
# Usage : depuis le dossier site-agenda-studio, lancer :  .\deploy_sync_social_artist.ps1
# Prérequis : npx supabase login (une fois)

$ErrorActionPreference = "Stop"
$ProjectRef = "bbdylrwiwnwjpeblxriq"
$SaUrl = "https://ivneqyuchqjgsmfrutfn.supabase.co"

Write-Host "Colle la cle service_role de Social Artist" -ForegroundColor Cyan
Write-Host "(dans social-artist/.env.local -> SUPABASE_SERVICE_ROLE_KEY)" -ForegroundColor DarkGray
$secure = Read-Host "SOCIAL_ARTIST_SERVICE_ROLE_KEY" -AsSecureString
$SaKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

if ([string]::IsNullOrWhiteSpace($SaKey)) { Write-Host "Cle vide, abandon." -ForegroundColor Red; exit 1 }

Write-Host "`n[1/2] Configuration des secrets..." -ForegroundColor Green
npx supabase secrets set "SOCIAL_ARTIST_SUPABASE_URL=$SaUrl" "SOCIAL_ARTIST_SERVICE_ROLE_KEY=$SaKey" --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { Write-Host "Echec secrets set." -ForegroundColor Red; exit 1 }

Write-Host "`n[2/2] Deploiement de la fonction..." -ForegroundColor Green
npx supabase functions deploy sync-user-to-social-artist --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { Write-Host "Echec deploy." -ForegroundColor Red; exit 1 }

Write-Host "`nTermine ! Teste en t'inscrivant sur Make Music avec un email neuf." -ForegroundColor Cyan
