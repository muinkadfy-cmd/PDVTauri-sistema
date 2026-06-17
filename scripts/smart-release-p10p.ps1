param(
  [string]$NewVersion = "",
  [string]$WorkerUrl = "https://smart-tech-pdv-license.muinkadfy.workers.dev",
  [string]$UpdateBaseUrl = "https://smarttech-updates.pages.dev",
  [string]$CloudflareProject = "smarttech-updates",
  [switch]$AllowUnsigned,
  [switch]$Publish,
  [switch]$SkipVersion,
  [switch]$NoBuild,
  [switch]$NoUpdater,
  [switch]$MsiOnly
)

$ErrorActionPreference = "Stop"

function Write-Ok([string]$Message) { Write-Host $Message -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host $Message -ForegroundColor Yellow }
function Write-Info([string]$Message) { Write-Host $Message -ForegroundColor Cyan }

function Run-Step([string]$Label, [scriptblock]$Block) {
  Write-Host ""
  Write-Info "Executando: $Label"
  $global:LASTEXITCODE = 0
  & $Block
  if ($LASTEXITCODE -ne 0) {
    throw "Falha em: $Label | ExitCode=$LASTEXITCODE"
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $Dir = Split-Path $Path -Parent
  if ($Dir -and -not (Test-Path $Dir)) {
    New-Item -ItemType Directory -Path $Dir -Force | Out-Null
  }
  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $Path), $Text + [Environment]::NewLine, $Utf8NoBom)
}

function Get-PackageVersion {
  return [string]((Get-Content ".\package.json" -Raw | ConvertFrom-Json).version)
}

function Validate-Version([string]$V) {
  if ([string]::IsNullOrWhiteSpace($V) -or $V -notmatch '^2\.\d+\.\d+$') {
    throw "Versao invalida: $V. Use exemplo 2.0.78. Nunca use 20.0.xx."
  }
}

function Set-LicenseBuildUrl([string]$Url) {
  if ([string]::IsNullOrWhiteSpace($Url)) { throw "URL do Worker vazia." }
  $Url = $Url.Trim().TrimEnd('/')
  $Text = @"
VITE_SMARTTECH_LICENSE_API_URL=$Url
VITE_LICENSE_WORKER_URL=$Url
VITE_HYBRID_LICENSE_WORKER_URL=$Url
VITE_SMARTTECH_LICENSE_WORKER_URL=$Url
VITE_HYBRID_LICENSE_API_URL=$Url
VITE_LICENSE_API_URL=$Url
SMARTTECH_LICENSE_API_URL=$Url
"@
  foreach ($f in @(".env.local", ".env.desktop.local", ".env.production.local")) {
    Write-Utf8NoBom $f $Text
  }
  Write-Ok "Worker da licenca configurado para o build: $Url"
}

function Set-UpdaterEnv([string]$BaseUrl) {
  if ([string]::IsNullOrWhiteSpace($BaseUrl)) { throw "UpdateBaseUrl vazio." }
  $BaseUrl = $BaseUrl.Trim().TrimEnd('/')

  $env:VITE_DESKTOP_UPDATE_ENDPOINTS = "$BaseUrl/latest.json"
  $env:CLOUDFLARE_UPDATE_BASE_URL = $BaseUrl
  $env:UPDATE_BASE_URL = $BaseUrl

  $PubPath = ".\.updater-secrets\smarttech-updater.pub"
  if (-not $env:VITE_DESKTOP_UPDATE_PUBKEY -and (Test-Path $PubPath)) {
    $env:VITE_DESKTOP_UPDATE_PUBKEY = (Get-Content $PubPath -Raw).Trim()
  }

  $KeyPath = ".\.updater-secrets\smarttech-updater.key"
  if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PATH -and (Test-Path $KeyPath)) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PATH = (Resolve-Path $KeyPath).Path
  }

  $PassPath = "C:\SmartTech-Segredos\UPDATER_KEY_PASSWORD.txt"
  if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -and (Test-Path $PassPath)) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content $PassPath -Raw).Trim()
  }

  if (-not $NoUpdater -and -not $MsiOnly) {
    $Missing = @()
    if (-not $env:VITE_DESKTOP_UPDATE_ENDPOINTS) { $Missing += "VITE_DESKTOP_UPDATE_ENDPOINTS" }
    if (-not $env:VITE_DESKTOP_UPDATE_PUBKEY) { $Missing += "VITE_DESKTOP_UPDATE_PUBKEY ou .updater-secrets\smarttech-updater.pub" }
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PATH -and -not $env:TAURI_SIGNING_PRIVATE_KEY) { $Missing += "TAURI_SIGNING_PRIVATE_KEY_PATH ou TAURI_SIGNING_PRIVATE_KEY" }
    if ($Missing.Count -gt 0) {
      throw "Updater assinado nao configurado: $($Missing -join ', ')"
    }
  }

  Write-Ok "Updater configurado para: $($env:VITE_DESKTOP_UPDATE_ENDPOINTS)"
}

function Get-NewestBundleFiles([string]$Version) {
  $BundleRoot = ".\src-tauri\target\release\bundle"
  $Msi = Get-ChildItem $BundleRoot -Recurse -Filter "*.msi" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match [regex]::Escape($Version) } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  $Sig = Get-ChildItem $BundleRoot -Recurse -Filter "*.sig" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match [regex]::Escape($Version) } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  return @{ Msi = $Msi; Sig = $Sig }
}

function Assert-UpdateArtifacts([string]$Version) {
  $Files = Get-NewestBundleFiles $Version
  if (-not $Files.Msi) { throw "MSI da versao $Version nao encontrado em src-tauri\target\release\bundle." }
  if (-not $NoUpdater -and -not $MsiOnly -and -not $Files.Sig) { throw "SIG da versao $Version nao encontrado. Update online seria invalido." }
  Write-Ok "MSI encontrado: $($Files.Msi.FullName)"
  if ($Files.Sig) { Write-Ok "SIG encontrado: $($Files.Sig.FullName)" }
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

Write-Host "=== SMART TECH PDV - RELEASE AUTOMATICO P10P ===" -ForegroundColor Cyan
Set-LicenseBuildUrl $WorkerUrl
Set-UpdaterEnv $UpdateBaseUrl

if (-not $SkipVersion) {
  if ([string]::IsNullOrWhiteSpace($NewVersion)) {
    $Current = Get-PackageVersion
    Write-Warn "Versao atual: $Current"
    $NewVersion = Read-Host "Digite a nova versao 2.x, ou ENTER para manter"
  }

  if (-not [string]::IsNullOrWhiteSpace($NewVersion)) {
    Validate-Version $NewVersion
    Run-Step "sincronizar versao P10P para $NewVersion" { node scripts/p10n-sync-version.mjs $NewVersion }
  } else {
    Write-Warn "Mantendo versao atual."
  }
}

$Version = Get-PackageVersion
Validate-Version $Version

Run-Step "prebuild" { npm run prebuild }
Run-Step "fix version.json exato" { node scripts/fix-public-version-exact-p10m.mjs }
Run-Step "check version lock P10G" { npm run check:version-lock-p10g }
Run-Step "check P10M" { npm run check:release-p10m }
Run-Step "check P10N automation" { npm run check:p10n-automation }
Run-Step "check P10P readiness" { npm run check:p10p-release }
Run-Step "release check" { npm run release:check }
Run-Step "type check" { npm run type-check }

if (-not $NoBuild) {
  $BuildArgs = @("scripts/build-msi-signed-auto.mjs", "--release")
  if (-not $NoUpdater -and -not $MsiOnly) { $BuildArgs += "--with-updater" }
  if ($AllowUnsigned) { $BuildArgs += "--allow-unsigned" }

  Run-Step "build MSI + updater artifacts" { node @BuildArgs }
  Assert-UpdateArtifacts $Version

  if (-not $NoUpdater -and -not $MsiOnly) {
    Run-Step "gerar update-site latest.json" { node scripts/generate-tauri-latest-json.mjs --base-url $UpdateBaseUrl }
    $env:P10P_REQUIRE_LATEST = "1"
    Run-Step "validar update-site P10P" { node scripts/check-release-p10p.mjs --require-latest }
    Remove-Item Env:\P10P_REQUIRE_LATEST -ErrorAction SilentlyContinue

    if ($Publish) {
      Run-Step "publicar Cloudflare Pages" { npx wrangler pages deploy ".\update-site" --project-name $CloudflareProject }
      $Cache = Get-Date -Format yyyyMMddHHmmss
      Write-Info "Conferindo online: $UpdateBaseUrl/latest.json?cache=$Cache"
      $Online = Invoke-RestMethod "$UpdateBaseUrl/latest.json?cache=$Cache"
      if ([string]$Online.version -ne [string]$Version) { throw "Cloudflare ainda retornou $($Online.version), esperado $Version." }
      if (-not $Online.platforms.'windows-x86_64'.signature) { throw "Cloudflare retornou latest.json sem signature." }
      Write-Ok "Cloudflare online OK: $($Online.version)"
    }
  }

  Write-Host ""
  Write-Ok "Arquivos MSI mais recentes:"
  Get-ChildItem -Recurse -Filter "*.msi" | Sort-Object LastWriteTime -Descending | Select-Object -First 10 FullName,LastWriteTime,Length | Format-Table -AutoSize
}

Write-Host ""
Write-Ok "P10P concluido: release automatizado sem signature null."
