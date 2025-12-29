@echo off
REM ============================================
REM Glaucoma IOP Monitoring System - Frontend Start
REM ============================================

echo.
echo ======================================
echo Glaucoma IOP Monitoring System - Frontend
echo ======================================
echo.

REM Check if running from correct directory
if not exist "src\App.jsx" (
    echo ERROR: Must run from project root directory (e:\Hackathon)
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo Starting Frontend Development Server...
echo.
echo Frontend will be available at: http://localhost:5173
echo Backend should be running on: http://localhost:8000
echo.

call npm run dev

REM Keep window open if script exits
pause
