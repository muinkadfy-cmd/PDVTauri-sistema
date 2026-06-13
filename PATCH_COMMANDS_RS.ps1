# =============================================================================
# PATCH DEFINITIVO - Corrige commands.rs do tauri-plugin-rusqlite2 no cache
# =============================================================================
# Execute EM QUALQUER PASTA com:
#   powershell -ExecutionPolicy Bypass -File PATCH_COMMANDS_RS.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$commandsPath = "C:\Users\$env:USERNAME\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\tauri-plugin-rusqlite2-2.2.7\src\commands.rs"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  PATCH commands.rs — tauri-plugin-rusqlite2 2.2.7"         -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se o arquivo existe
if (-not (Test-Path $commandsPath)) {
    Write-Host "[ERRO] Arquivo nao encontrado:" -ForegroundColor Red
    Write-Host "  $commandsPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Tentando localizar automaticamente..." -ForegroundColor Yellow
    
    $found = Get-ChildItem "$env:USERPROFILE\.cargo\registry\src" -Recurse -Filter "commands.rs" |
             Where-Object { $_.FullName -like "*rusqlite2-2.2.7*" } |
             Select-Object -First 1
    
    if ($found) {
        $commandsPath = $found.FullName
        Write-Host "  Encontrado: $commandsPath" -ForegroundColor Green
    } else {
        Write-Host "[ERRO FATAL] Arquivo nao encontrado. Execute 'cargo fetch' primeiro." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Arquivo: $commandsPath" -ForegroundColor Green

# Fazer backup
$backupPath = $commandsPath + ".backup_original"
if (-not (Test-Path $backupPath)) {
    Copy-Item $commandsPath $backupPath
    Write-Host "Backup: $backupPath" -ForegroundColor Green
} else {
    Write-Host "Backup ja existe: $backupPath" -ForegroundColor Yellow
}

# Ler linhas do arquivo
$lines = Get-Content $commandsPath
$totalLines = $lines.Count
Write-Host "Total de linhas: $totalLines"
Write-Host ""

# Verificar se as linhas problemáticas existem
$line557 = $lines[556]  # 0-indexed
Write-Host "Linha 557 atual: $line557"

if ($line557 -notlike "*load_extension_enable*") {
    Write-Host ""
    Write-Host "[AVISO] Linha 557 nao contem load_extension_enable" -ForegroundColor Yellow
    Write-Host "Buscando a funcao load_extensions no arquivo..." -ForegroundColor Yellow
    
    $funcLine = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -like "*load_extension_enable*") {
            Write-Host "  Encontrado em linha $($i+1): $($lines[$i])"
            $funcLine = $i
        }
    }
    
    if ($funcLine -eq -1) {
        Write-Host "[INFO] load_extension_enable NAO encontrado no arquivo." -ForegroundColor Yellow
        Write-Host "O arquivo pode ja estar patched ou ser uma versao diferente." -ForegroundColor Yellow
        
        # Verificar versão
        $cargoToml = $commandsPath.Replace("src\commands.rs", "Cargo.toml")
        if (Test-Path $cargoToml) {
            Write-Host ""
            Write-Host "Cargo.toml do plugin:" -ForegroundColor Cyan
            Get-Content $cargoToml | Where-Object { $_ -like "*rusqlite*" -or $_ -like "*version*" }
        }
        exit 0
    }
}

# Aplicar patch: substituir as 3 ocorrências problemáticas
Write-Host "Aplicando patch nas linhas problemáticas..." -ForegroundColor Yellow
Write-Host ""

$newLines = @()
$i = 0
$patchCount = 0

while ($i -lt $lines.Count) {
    $line = $lines[$i]
    
    # Detectar início do bloco problemático
    if ($line -match '^\s+conn\.load_extension_enable\(\)') {
        Write-Host "  Patch linha $($i+1): $($line.Trim())"
        
        # Pular as linhas do bloco inteiro até load_extension_disable terminar
        # Substituir pelo bloco compilável sem a feature
        $indent = ($line -replace '^(\s+).*', '$1')
        
        $newLines += "${indent}// load_extension patched - feature not required by this app"
        $newLines += "${indent}let _ = &extensions;"
        $newLines += "${indent}// Extensions not loaded: loadable_extension feature not active"
        
        $patchCount++
        
        # Avançar até depois de load_extension_disable
        while ($i -lt $lines.Count -and $lines[$i] -notmatch 'load_extension_disable') {
            $i++
        }
        # Pular o load_extension_disable e o .map_err seguinte
        if ($i -lt $lines.Count) { $i++ } # load_extension_disable linha
        if ($i -lt $lines.Count -and $lines[$i] -match '\.map_err') { $i++ } # .map_err
        if ($i -lt $lines.Count -and $lines[$i] -match '^\s*\?') { $i++ } # ?
        
        continue
    }
    
    $newLines += $line
    $i++
}

Write-Host ""
if ($patchCount -eq 0) {
    Write-Host "[AVISO] Nenhum patch aplicado - o bloco nao foi encontrado no formato esperado" -ForegroundColor Yellow
    Write-Host "Tentando abordagem alternativa (substituicao direta por linha)..." -ForegroundColor Yellow
    
    # Abordagem alternativa: substituir linha por linha diretamente
    $content = Get-Content $commandsPath -Raw
    
    # Substituições diretas
    $content = $content -replace 'conn\.load_extension_enable\(\)\s*\n\s*\.map_err\(\|e\|[^?]+\)\?;', `
        'let _ = 0u8; // load_extension_enable patched out'
    
    $content = $content -replace 'conn\.load_extension_disable\(\)\s*\n\s*\.map_err\(\|e\|[^?]+\)\?;', `
        'let _ = 0u8; // load_extension_disable patched out'
    
    $content = $content -replace 'if let Err\(e\) = conn\.load_extension\(ext, None::<&str>\) \{[^}]+\}', `
        'let _ = &ext; // load_extension patched out'
    
    Set-Content -Path $commandsPath -Value $content -Encoding UTF8 -NoNewline
    Write-Host "  Substituicao direta aplicada" -ForegroundColor Green
    
} else {
    # Salvar arquivo com patches aplicados
    Set-Content -Path $commandsPath -Value ($newLines -join "`n") -Encoding UTF8 -NoNewline
    Write-Host "Patches aplicados: $patchCount" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Patch concluido! Agora execute:"                            -ForegroundColor Green
Write-Host ""
Write-Host "    cd C:\PDVTauri"                                           -ForegroundColor Yellow
Write-Host "    cargo tauri build"                                         -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
