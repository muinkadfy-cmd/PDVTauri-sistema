param(
  [int]$Cycles = 3,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$artifactDir = Join-Path $root "qa-artifacts\stress-$timestamp"
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$logFile = Join-Path $artifactDir 'qa-run.log'

function Write-Step([string]$message) {
  $line = "[$(Get-Date -Format 'HH:mm:ss')] $message"
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

function Get-ToolPath([string]$name) {
  $cmd = Get-Command $name -ErrorAction Stop
  return $cmd.Source
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [hashtable]$EnvVars = @{}
  )

  Write-Step $Label
  $safeName = (($Label -replace '[^A-Za-z0-9_-]', '_').Trim('_'))
  $stdoutFile = Join-Path $artifactDir ($safeName + '.stdout.log')
  $stderrFile = Join-Path $artifactDir ($safeName + '.stderr.log')
  if (Test-Path $stdoutFile) { Remove-Item $stdoutFile -Force }
  if (Test-Path $stderrFile) { Remove-Item $stderrFile -Force }

  $previous = @{}
  foreach ($key in $EnvVars.Keys) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, [string]$EnvVars[$key], 'Process')
  }

  try {
    $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $root -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile

    if (Test-Path $stdoutFile) {
      Get-Content $stdoutFile | ForEach-Object {
        Write-Host $_
        Add-Content -Path $logFile -Value $_
      }
    }
    if (Test-Path $stderrFile) {
      Get-Content $stderrFile | ForEach-Object {
        Write-Host $_
        Add-Content -Path $logFile -Value $_
      }
    }

    if ($process.ExitCode -ne 0) {
      throw "Falha em: $Label (exit=$($process.ExitCode))"
    }
  }
  finally {
    foreach ($key in $EnvVars.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process')
    }
  }
}

$npm = Get-ToolPath 'npm.cmd'
$npx = Get-ToolPath 'npx.cmd'

Write-Step "Iniciando coleta de QA em $artifactDir"

if (-not $SkipInstall) {
  Invoke-Step -Label 'npm install' -FilePath $npm -Arguments @('install')
  Invoke-Step -Label 'playwright install chromium' -FilePath $npx -Arguments @('playwright', 'install', 'chromium')
}

Invoke-Step -Label 'type check' -FilePath $npm -Arguments @('run', 'type-check')
Invoke-Step -Label 'playwright collect' -FilePath $npm -Arguments @('run', 'qa:e2e:collect') -EnvVars @{ E2E_STRESS_CYCLES = $Cycles }

if (Test-Path (Join-Path $root 'playwright-report')) {
  Copy-Item -Recurse -Force (Join-Path $root 'playwright-report') (Join-Path $artifactDir 'playwright-report')
}

if (Test-Path (Join-Path $root 'test-results')) {
  Copy-Item -Recurse -Force (Join-Path $root 'test-results') (Join-Path $artifactDir 'test-results')
}

Write-Step 'Compactando artefatos'
$zipPath = Join-Path $root "qa-artifacts\stress-$timestamp.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $artifactDir '*') -DestinationPath $zipPath -Force

Write-Step "Finalizado. Envie estes itens:"
Write-Step "1) $zipPath"
Write-Step "2) $artifactDir\qa-run.log"
Write-Step "3) prints/vídeos/traces dentro de $artifactDir\test-results"
