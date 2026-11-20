@echo off
chcp 65001 >nul
title CTH612 - Frontend Next.js
cd /d "%~dp0frontend-nextjs"
set BACKEND_URL=http://127.0.0.1:8080
set NEXT_PUBLIC_API_BASE_URL=
call npm.cmd run dev -- --hostname 0.0.0.0 --port 3000
pause
