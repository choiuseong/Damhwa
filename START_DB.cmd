@echo off
cd /d "%~dp0backend"
if not exist "node_modules\@electric-sql\pglite\dist\pglite.data" (
 echo PGlite data file not installed. Running npm ci...
 call npm ci
 if errorlevel 1 (echo npm ci FAILED & pause & exit /b 1)
)
if not exist ".env" (copy ".env.example" ".env" >nul)
call npm run db:local
pause
