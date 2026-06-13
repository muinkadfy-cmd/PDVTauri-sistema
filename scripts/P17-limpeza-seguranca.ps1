# P17 — Higienização de Segurança Smart Tech PDV
# Rode dentro da pasta C:\PDVTauri-sistema

Write-Host "P17 - Movendo segredos e artefatos para quarentena..." -ForegroundColor Cyan
npm run security:quarantine

Write-Host "P17 - Verificando se o projeto ficou limpo..." -ForegroundColor Cyan
npm run check:release-secrets

Write-Host "P17 - Gerando pacote fonte limpo..." -ForegroundColor Cyan
npm run release:clean-package

Write-Host "P17 finalizado. Confira a pasta release\SmartTechPDV-clean-source" -ForegroundColor Green
