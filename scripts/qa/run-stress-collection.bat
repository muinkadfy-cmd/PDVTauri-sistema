@echo off
setlocal
set CYCLES=%2
if /I "%1"=="-Cycles" set CYCLES=%2
if "%CYCLES%"=="" set CYCLES=3
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-stress-collection.ps1" -Cycles %CYCLES%
endlocal
