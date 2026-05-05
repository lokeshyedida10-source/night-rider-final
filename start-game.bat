@echo off
setlocal
cd /d "%~dp0"

echo Starting Night Rider game server...
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8000"
  py -m http.server 8000
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8000"
  python -m http.server 8000
  goto :eof
)

echo Python is not installed or unavailable.
echo Opening game directly in your default browser...
start "" "%~dp0index.html"
echo.
echo If browser still says "unable to open", right-click index.html and choose Open with Chrome/Edge.
pause
