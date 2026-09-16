<#
    Ouvre HackaMetz sur Internet via Cloudflare Tunnel, sans compte ni nom de domaine.

        powershell -ExecutionPolicy Bypass -File deploy\tunnel-windows.ps1

    Le script installe cloudflared au besoin (winget), lance le tunnel, affiche l'adresse
    publique avec son QR code, et l'ecrit dans deploy\url-publique.txt.

    A savoir : une adresse de tunnel rapide (*.trycloudflare.com) change a chaque relance du
    tunnel. Laisse cette fenetre ouverte pendant l'evenement. Pour une adresse stable, voir
    deploy\README.md (Tailscale Funnel ou tunnel nomme Cloudflare).

    Note : ce fichier evite les apostrophes typographiques, que PowerShell prend pour des guillemets.
#>
[CmdletBinding()]
param(
    [int]$Port = 3001
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$urlFile = Join-Path $PSScriptRoot "url-publique.txt"

function Step($message) { Write-Host "`n==> $message" -ForegroundColor Cyan }

Step "Le serveur repond-il ?"
try {
    Invoke-RestMethod "http://localhost:$Port/api/health" -TimeoutSec 5 | Out-Null
    Write-Host "    Oui."
} catch {
    throw "Rien ne repond sur le port $Port. Lance d'abord deploy\install-windows.ps1 (ou npm start)."
}

Step "cloudflared"
$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) {
    Write-Host "    Installation via winget..."
    winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
    $cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
    if (-not $cloudflared) {
        throw "cloudflared reste introuvable. Installe-le depuis https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ puis relance ce script."
    }
}
Write-Host "    $cloudflared"

Step "Ouverture du tunnel"
Write-Host "    Laisse cette fenetre ouverte : fermer le tunnel coupe l'acces depuis Internet." -ForegroundColor Yellow

# cloudflared ecrit son journal (et l'URL) sur la sortie d'erreur : on la lit ligne par ligne.
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $cloudflared
$psi.Arguments = "tunnel --no-autoupdate --url http://localhost:$Port"
$psi.RedirectStandardError = $true
$psi.RedirectStandardOutput = $true
$psi.UseShellExecute = $false
$process = [System.Diagnostics.Process]::Start($psi)

$published = $false
while (-not $process.HasExited) {
    $line = $process.StandardError.ReadLine()
    if ($null -eq $line) { break }

    if (-not $published -and $line -match "https://[a-z0-9-]+\.trycloudflare\.com") {
        $url = $Matches[0]
        $published = $true
        Set-Content -Path $urlFile -Value $url -Encoding utf8
        Write-Host ""
        Write-Host "    Adresse publique : $url" -ForegroundColor Green
        Write-Host "    (egalement ecrite dans $urlFile)"
        Write-Host ""
        Push-Location $root
        node scripts/qr.mjs $url
        Pop-Location
        Write-Host "Partage cette adresse aux participants. Ctrl+C ferme le tunnel." -ForegroundColor Gray
    } elseif ($line -match "ERR|error") {
        Write-Host "    $line" -ForegroundColor DarkYellow
    }
}

$process.WaitForExit()
Write-Host "`nTunnel ferme - l'app reste accessible sur le reseau local." -ForegroundColor Yellow
