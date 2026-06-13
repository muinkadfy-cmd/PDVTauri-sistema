param(
  [int]$Cycles = 3,
  [switch]$SkipInstall,
  [switch]$SkipDesktopBuild
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $root "qa-artifacts\master-$stamp"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$log = Join-Path $outDir 'master-qa.log'

function Write-Log([string]$text) {
  Write-Host $text
  Add-Content -Path $log -Value $text
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

  Write-Log ""
  Write-Log "=== $Label ==="
  Write-Log ($FilePath + ' ' + (($Arguments | ForEach-Object {
    if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
  }) -join ' '))

  $stdoutFile = Join-Path $outDir ((($Label -replace '[^A-Za-z0-9_-]', '_').Trim('_')) + '.stdout.log')
  $stderrFile = Join-Path $outDir ((($Label -replace '[^A-Za-z0-9_-]', '_').Trim('_')) + '.stderr.log')
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
        Add-Content -Path $log -Value $_
      }
    }
    if (Test-Path $stderrFile) {
      Get-Content $stderrFile | ForEach-Object {
        Write-Host $_
        Add-Content -Path $log -Value $_
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

if (-not $SkipInstall) {
  Invoke-Step -Label 'npm install' -FilePath $npm -Arguments @('install')
  Invoke-Step -Label 'playwright install chromium' -FilePath $npx -Arguments @('playwright', 'install', 'chromium')
}

Invoke-Step -Label 'release check' -FilePath $npm -Arguments @('run', 'release:check')
Invoke-Step -Label 'type check' -FilePath $npm -Arguments @('run', 'type-check')
if (-not $SkipDesktopBuild) {
  Invoke-Step -Label 'build desktop' -FilePath $npm -Arguments @('run', 'build:desktop')
}
Invoke-Step -Label 'unit finance regression' -FilePath $npm -Arguments @('run', 'qa:unit:finance')
Invoke-Step -Label 'release e2e suite' -FilePath $npm -Arguments @('run', 'qa:e2e:release')
Invoke-Step -Label 'master e2e matrix' -FilePath $npm -Arguments @('run', 'qa:e2e:matrix') -EnvVars @{ QA_CYCLES = $Cycles }

$playwrightReport = Join-Path $root 'playwright-report'
if (Test-Path $playwrightReport) {
  Copy-Item $playwrightReport -Destination (Join-Path $outDir 'playwright-report') -Recurse -Force
}

$testResults = Join-Path $root 'test-results'
if (Test-Path $testResults) {
  Copy-Item $testResults -Destination (Join-Path $outDir 'test-results') -Recurse -Force
}

$zipPath = Join-Path $root "qa-artifacts\master-$stamp.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $outDir -DestinationPath $zipPath -Force

Write-Host "QA MASTER concluído. Artefatos: $zipPath"
