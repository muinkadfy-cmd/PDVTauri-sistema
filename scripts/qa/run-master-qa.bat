@echo off
setlocal
set CYCLES=%1
if "%CYCLES%"=="" set CYCLES=3
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-master-qa.ps1" -Cycles %CYCLES%
endlocal
