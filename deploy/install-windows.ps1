<#
    Installe HackaMetz comme service permanent sur une machine Windows qui reste allumee.

        powershell -ExecutionPolicy Bypass -File deploy\install-windows.ps1

    Ce que fait le script :
      1. verifie Node, installe les dependances, construit l'app ;
      2. cree un .env avec une vraie cle d'organisateur s'il n'y en a pas ;
      3. enregistre deux taches planifiees qui survivent au redemarrage et a la fermeture de session :
         "HackaMetz" (le serveur, relance automatiquement s'il tombe) et
         "HackaMetz-Sauvegarde" (copie des donnees toutes les deux heures).

    A lancer dans un terminal PowerShell ADMINISTRATEUR (les taches tournent en tant que SYSTEM).

    Note : ce fichier evite les apostrophes typographiques, que PowerShell prend pour des guillemets.
#>
[CmdletBinding()]
param(
    [int]$Port = 3001,
    [string]$TaskName = "HackaMetz",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Step($message) { Write-Host "`n==> $message" -ForegroundColor Cyan }

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principalCheck = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principalCheck.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Lance ce script dans un PowerShell administrateur."
}

Step "Verification de Node"
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "Node.js est introuvable. Installe-le depuis https://nodejs.org (LTS)." }
Write-Host "    $node  $(node --version)"

Set-Location $root

Step "Cle d'organisateur"
$envPath = Join-Path $root ".env"
$needsKey = $true
if (Test-Path $envPath) {
    $match = Select-String -Path $envPath -Pattern "^ADMIN_KEY=(.*)$"
    if ($match) {
        $key = $match.Matches.Groups[1].Value.Trim()
        if ($key.Length -ge 24) { $needsKey = $false }
    }
}
if ($needsKey) {
    Write-Host "    Generation d'une cle..." -ForegroundColor Yellow
    node scripts/admin-key.mjs
} else {
    Write-Host "    Cle deja en place (elle n'est pas affichee)."
}

if (-not $SkipBuild) {
    Step "Installation des dependances"
    npm ci
    Step "Construction de l'application"
    $env:NODE_ENV = "production"
    npm run build
}

Step "Tache planifiee : le serveur"
$serverAction = New-ScheduledTaskAction -Execute $node -Argument "server/dist/server.js" -WorkingDirectory $root
$atBoot = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $serverAction -Trigger $atBoot `
    -Settings $settings -Principal $principal -Force `
    -Description "Serveur HackaMetz (port $Port)" | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "    Tache $TaskName enregistree et demarree."

Step "Tache planifiee : les sauvegardes"
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if ($npm) {
    $backupAction = New-ScheduledTaskAction -Execute $npm -Argument "run backup" -WorkingDirectory $root
    $everyTwoHours = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) `
        -RepetitionInterval (New-TimeSpan -Hours 2)
    Register-ScheduledTask -TaskName "$TaskName-Sauvegarde" -Action $backupAction -Trigger $everyTwoHours `
        -Settings $settings -Principal $principal -Force `
        -Description "Sauvegarde des donnees et des projets HackaMetz" | Out-Null
    Write-Host "    Tache $TaskName-Sauvegarde enregistree (toutes les 2 heures)."
} else {
    Write-Host "    npm introuvable : sauvegarde a planifier a la main." -ForegroundColor Yellow
}

Step "Verification"
Start-Sleep -Seconds 4
try {
    $health = Invoke-RestMethod "http://localhost:$Port/api/health" -TimeoutSec 10
    Write-Host "    Serveur en ligne - version $($health.version)" -ForegroundColor Green
} catch {
    Write-Host "    Pas encore de reponse sur le port $Port. Verifie avec : Get-ScheduledTask $TaskName" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Prochaine etape : exposer le serveur sur Internet." -ForegroundColor Gray
Write-Host "  powershell -ExecutionPolicy Bypass -File deploy\tunnel-windows.ps1" -ForegroundColor Gray
Write-Host "Puis ouvre l'app avec ta cle d'organisateur et cree l'edition du soir." -ForegroundColor Gray
Write-Host ""
Write-Host "Arreter / relancer :  Stop-ScheduledTask $TaskName  |  Start-ScheduledTask $TaskName" -ForegroundColor Gray
Write-Host "Desinstaller :        Unregister-ScheduledTask -TaskName $TaskName, '$TaskName-Sauvegarde'" -ForegroundColor Gray
