@echo off
REM ============================================
REM Glaucoma IOP Monitoring System - Start Script
REM ============================================

echo.
echo ======================================
echo Glaucoma IOP Monitoring System Launcher
echo ======================================
echo.

REM Check if running from correct directory
if not exist "src\App.jsx" (
    echo ERROR: Must run from project root directory (e:\Hackathon)
    pause
    exit /b 1
)

echo Starting Backend Server...
echo.
cd backend
call ..\\.venv\\Scripts\\python.exe run.py

REM Keep window open if script exits
pause
