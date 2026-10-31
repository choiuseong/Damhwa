@echo off
setlocal
cd /d "%~dp0"
echo === Damhwa merged preflight ===
if not exist "backend\package.json" (echo ERROR: backend package.json missing & exit /b 1)
if not exist "frontend\package.json" (echo ERROR: frontend package.json missing & exit /b 1)
if not exist "backend\scripts\local-db.ts" (echo ERROR: local-db.ts missing & exit /b 1)
if not exist "backend\prisma\migrations\20261030000000_cyber_kyungrodang\migration.sql" (echo ERROR: chat DB migration missing & exit /b 1)
node -e "const p=require('./backend/package.json');if(!p.scripts['db:local'])process.exit(1);console.log('DB launch script OK')"
if errorlevel 1 (echo ERROR: db:local missing & exit /b 1)
echo FILE CHECK PASS
echo Run from this directory; avoid %% encoded or Korean-named parent folders for PGlite.
