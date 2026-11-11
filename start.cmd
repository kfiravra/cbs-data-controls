@echo off
rem Starts the whole system with Docker on Windows. Double-click it, or run it from a command prompt.
rem It runs scripts\start.ps1 with Windows PowerShell; -ExecutionPolicy Bypass applies to this one run only.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
set DC_EXIT=%ERRORLEVEL%
rem Opened by a double-click, the window would close before the address can be read.
echo %CMDCMDLINE% | findstr /i /c:"/c" >nul && pause
exit /b %DC_EXIT%
