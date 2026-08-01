@echo off
REM Levanta la app en local y la abre en el navegador.
REM La app necesita un servidor: con doble clic sobre index.html no funciona.

cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo No se ha encontrado Python. Alternativa con Node:
  echo    npx --yes serve app -l 8123
  pause
  exit /b 1
)

start "" http://localhost:8123
echo.
echo   Italia 2026 en http://localhost:8123
echo   Cierra esta ventana para parar el servidor.
echo.
python -m http.server 8123 --directory app
