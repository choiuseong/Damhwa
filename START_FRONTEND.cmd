@echo off
cd /d "%~dp0frontend"
if not exist ".env" (
 echo First launch: set EXPO_PUBLIC_API_URL=http://YOUR_PC_IPV4:3000 in frontend\.env
 copy ".env.example" ".env" >nul
 notepad ".env"
)
if not exist "node_modules\.bin\expo.cmd" (call npm ci & if errorlevel 1 (pause & exit /b 1))
call npx expo start --clear
pause
