@echo off
title Orbit - Next.js
cd /d "%~dp0"
echo Starting Orbit Next.js at http://localhost:3000
call npm.cmd run dev
echo.
echo Next.js stopped. Close this window or run start-nextjs.cmd again.
pause
