@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "NODE_VERSION=v24.11.0"
set "NODE_EXE="
set "NPM_CMD="

if exist "runtime\node.exe" (
  set "NODE_EXE=%~dp0runtime\node.exe"
  if exist "runtime\npm.cmd" set "NPM_CMD=%~dp0runtime\npm.cmd"
  goto :check_deps
)

where node >nul 2>nul
if %errorlevel%==0 (
  for /f "delims=v." %%v in ('node -v') do set "NODE_MAJOR=%%v"
  if !NODE_MAJOR! GEQ 22 (
    set "NODE_EXE=node"
    where npm.cmd >nul 2>nul && set "NPM_CMD=npm.cmd"
    goto :check_deps
  )
)

echo [CuseSoft] No se encontro Node.js 22+ en el equipo.
echo [CuseSoft] Descargando Node.js portable %NODE_VERSION% en .\runtime (sin instalador)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$url='https://nodejs.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip';" ^
  "$zip=Join-Path $env:TEMP 'cusesoft-node-portable.zip';" ^
  "$tmp=Join-Path $env:TEMP 'cusesoft-node-extract';" ^
  "if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp };" ^
  "Invoke-WebRequest -Uri $url -OutFile $zip;" ^
  "Expand-Archive -Path $zip -DestinationPath $tmp -Force;" ^
  "if (Test-Path 'runtime') { Remove-Item -Recurse -Force 'runtime' };" ^
  "Move-Item -Path (Join-Path $tmp 'node-%NODE_VERSION%-win-x64') -Destination 'runtime';" ^
  "Remove-Item -Force $zip; Remove-Item -Recurse -Force $tmp"

if errorlevel 1 (
  echo [ERROR] No se pudo descargar Node.js portable. Verifica tu conexion a internet.
  pause
  exit /b 1
)

set "NODE_EXE=%~dp0runtime\node.exe"
set "NPM_CMD=%~dp0runtime\npm.cmd"

:check_deps
if not exist "node_modules\" (
  echo [CuseSoft] Instalando librerias en .\node_modules...
  if not defined NPM_CMD (
    echo [ERROR] No se encontro npm para instalar node_modules.
    pause
    exit /b 1
  )
  set "PATH=%~dp0runtime;%PATH%"
  if exist "package-lock.json" (
    call "%NPM_CMD%" ci
  ) else (
    call "%NPM_CMD%" install
  )
  if errorlevel 1 (
    echo [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [CuseSoft] Archivo .env creado desde .env.example.
  )
)

if not exist "public\assets\covers\" (
  echo [CuseSoft] Generando portadas y archivos de ejemplo...
  "%NODE_EXE%" scripts\make-assets.mjs
)

if "%~1"=="--dev" (
  echo [CuseSoft] Iniciando en modo desarrollo ^(recarga automatica para actualizaciones^)...
  "%NODE_EXE%" --watch --env-file-if-exists=.env server\index.js
) else (
  echo [CuseSoft] Iniciando CuseSoft Store...
  "%NODE_EXE%" --env-file-if-exists=.env server\index.js
)

if errorlevel 1 pause
