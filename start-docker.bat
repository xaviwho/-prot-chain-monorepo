@echo off
REM ProtChain Docker Startup Script
REM This script starts all Docker containers for the ProtChain system

echo 🚀 Starting ProtChain Docker Services...

REM Navigate to the script directory
cd /d "%~dp0"

REM Check if docker-compose.yml exists
if not exist "docker-compose.yml" (
    echo ❌ Error: docker-compose.yml not found in current directory
    pause
    exit /b 1
)

REM Stop any existing containers first
echo 🛑 Stopping existing containers...
docker-compose down

REM Remove any existing containers and networks
echo 🧹 Cleaning up...
docker-compose down --remove-orphans

REM Start all services
echo 🔄 Starting all services...
docker-compose up -d

REM Wait a moment for services to initialize
echo ⏳ Waiting for services to initialize...
timeout /t 5 /nobreak > nul

REM Check service status
echo 📊 Service Status:
docker-compose ps

echo.
echo ✅ ProtChain services startup completed!
echo.
echo 🌐 Services should be available at:
echo    - ProtChain API: http://localhost:8082
echo    - BioAPI: http://localhost:8000
echo    - IPFS Gateway: http://localhost:8080
echo    - PostgreSQL: localhost:5432
echo.
echo 🔍 To view logs: docker-compose logs [service-name]
echo 🛑 To stop services: docker-compose down
echo.
pause
