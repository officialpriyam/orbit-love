@echo off
title Orbit - Python Matching Service
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Python environment missing. Follow README.md setup instructions.
  pause
  exit /b 1
)
echo Starting Orbit matching service at http://localhost:8001
".venv\Scripts\python.exe" -m uvicorn matching.main:app --host 127.0.0.1 --port 8001
echo.
echo Matching service stopped. Close this window or run start-microservice.cmd again.
pause
