@echo off
chcp 65001 >nul
cd /d "%~dp0"
set NODE_ENV=production
if not exist data mkdir data
:loop
echo [%date% %time%] start>> data\run.log
node src/index.js >> data\run.log 2>> data\err.log
if %errorlevel%==3 exit /b 0
echo [%date% %time%] exit code %errorlevel%, restart in 5s>> data\run.log
timeout /t 5 /nobreak >nul
goto loop
