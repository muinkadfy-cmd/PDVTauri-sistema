# Smart Tech PDV - Correcao Definitiva do Erro Rust
# Execute como: powershell -ExecutionPolicy Bypass -File CORRIGIR_TUDO.ps1
# Dentro da pasta C:\PDVTauri

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  CORRECAO DEFINITIVA — load_extension_enable"         -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar pasta correta
if (-not (Test-Path "src-tauri\Cargo.toml")) {
    Write-Host "[ERRO] Execute dentro de C:\PDVTauri" -ForegroundColor Red
    Write-Host "  cd C:\PDVTauri" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File CORRIGIR_TUDO.ps1" -ForegroundColor Yellow
    exit 1
}

# ─── PASSO 1: Mostrar Cargo.toml atual ─────────────────────────────────────
Write-Host "[1/5] Cargo.toml ATUAL (antes da correcao):" -ForegroundColor Yellow
Write-Host "──────────────────────────────────────────"
Get-Content "src-tauri\Cargo.toml" | Write-Host -ForegroundColor Gray
Write-Host "──────────────────────────────────────────"
Write-Host ""

# ─── PASSO 2: Escrever Cargo.toml correto ──────────────────────────────────
Write-Host "[2/5] Escrevendo Cargo.toml correto..." -ForegroundColor Yellow

$cargoToml = @'
[package]
name = "smart-tech-pdv"
version = "2.0.42"
description = "Smart Tech PDV (Desktop)"
authors = ["Smart Tech"]
edition = "2021"

[lib]
name = "smart_tech_pdv_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", default-features = false, features = ["wry", "common-controls-v6", "compression", "dynamic-acl", "rustls-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-log = "2"
tauri-plugin-rusqlite2 = { version = "2.2.7", default-features = false, features = ["bundled", "backup", "blob"] }
log = "0.4"
rusqlite = { version = "0.38", features = ["bundled", "loadable_extension"] }
'@

Set-Content -Path "src-tauri\Cargo.toml" -Value $cargoToml -Encoding UTF8
Write-Host "   OK - rusqlite com loadable_extension declarado" -ForegroundColor Green
Write-Host ""

# ─── PASSO 3: Verificar que foi escrito ────────────────────────────────────
Write-Host "[3/5] Verificando Cargo.toml apos correcao..." -ForegroundColor Yellow
$content = Get-Content "src-tauri\Cargo.toml" -Raw
if ($content -match 'loadable_extension') {
    Write-Host "   OK - loadable_extension encontrado no arquivo" -ForegroundColor Green
} else {
    Write-Host "   [FALHA] loadable_extension NAO encontrado!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# ─── PASSO 4: Deletar Cargo.lock ───────────────────────────────────────────
Write-Host "[4/5] Deletando Cargo.lock..." -ForegroundColor Yellow
if (Test-Path "src-tauri\Cargo.lock") {
    Remove-Item "src-tauri\Cargo.lock" -Force
    Write-Host "   OK - Cargo.lock deletado" -ForegroundColor Green
} else {
    Write-Host "   Cargo.lock nao encontrado (OK)" -ForegroundColor Green
}

# Limpar build anterior
Push-Location "src-tauri"
cargo clean 2>$null
Pop-Location
Write-Host "   OK - cargo clean executado" -ForegroundColor Green
Write-Host ""

# ─── PASSO 5: Compilar ─────────────────────────────────────────────────────
Write-Host "[5/5] Compilando (pode demorar 10-15 min)..." -ForegroundColor Yellow
Write-Host ""

cargo tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Red
    Write-Host "  [FALHA] Build falhou - verifique erros acima"         -ForegroundColor Red
    Write-Host "======================================================" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  BUILD CONCLUIDO COM SUCESSO!"                         -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
