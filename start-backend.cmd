@echo off
chcp 65001 >nul
title CTH612 - Backend Java
cd /d "%~dp0backend-java"
java -jar target\distributed-flight-booking-0.0.1-SNAPSHOT.jar
pause
