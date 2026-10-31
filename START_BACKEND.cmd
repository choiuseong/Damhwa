@echo off
cd /d "%~dp0backend"
if not exist ".env" (copy ".env.example" ".env" >nul)
if not exist "node_modules\.bin\tsx.cmd" (call npm ci & if errorlevel 1 (pause & exit /b 1))
call npm run db:generate
if errorlevel 1 (echo Prisma generation FAILED & pause & exit /b 1)
call npm run dev
pause
