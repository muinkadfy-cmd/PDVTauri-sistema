@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║     APLICANDO CORREÇÃO — Smart Tech PDV Build Fix    ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: Verificar se está na pasta correta (deve ter src-tauri)
if not exist "src-tauri" (
    echo [ERRO] Execute este script dentro da pasta C:\PDVTauri
    echo        Exemplo: cd C:\PDVTauri ^&^& APLICAR_CORRECAO.bat
    pause
    exit /b 1
)

echo [1/5] Copiando Cargo.toml corrigido...
copy /Y "%~dp0src-tauri\Cargo.toml" "src-tauri\Cargo.toml"
if errorlevel 1 (
    echo [ERRO] Falha ao copiar Cargo.toml
    pause
    exit /b 1
)
echo       OK

echo [2/5] Copiando StatCard.tsx corrigido...
copy /Y "%~dp0src\components\ui\StatCard.tsx" "src\components\ui\StatCard.tsx"
if errorlevel 1 (
    echo [ERRO] Falha ao copiar StatCard.tsx
    pause
    exit /b 1
)
echo       OK

echo [3/5] Deletando Cargo.lock para forcar regeneracao...
if exist "src-tauri\Cargo.lock" (
    del /F /Q "src-tauri\Cargo.lock"
    echo       Cargo.lock deletado
) else (
    echo       Cargo.lock nao encontrado (OK)
)

echo [4/5] Limpando artefatos de compilacao...
cd src-tauri
cargo clean 2>nul
cd ..
echo       OK

echo [5/5] Iniciando build...
echo.
echo  Isso pode demorar alguns minutos na primeira vez.
echo  O Cargo vai baixar e recompilar as dependencias.
echo.
cargo tauri build

if errorlevel 1 (
    echo.
    echo [FALHA] O build terminou com erros. Verifique as mensagens acima.
    pause
    exit /b 1
) else (
    echo.
    echo ╔══════════════════════════════════════════════════════╗
    echo ║              BUILD CONCLUIDO COM SUCESSO!            ║
    echo ╚══════════════════════════════════════════════════════╝
)
pause
