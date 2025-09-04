#!/bin/bash

# ProtChain Docker Startup Script
# This script starts all Docker containers for the ProtChain system

echo "🚀 Starting ProtChain Docker Services..."

# Navigate to the correct directory
cd "$(dirname "$0")"

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found in current directory"
    exit 1
fi

# Stop any existing containers first
echo "🛑 Stopping existing containers..."
docker-compose down

# Remove any existing containers and networks
echo "🧹 Cleaning up..."
docker-compose down --remove-orphans

# Start all services
echo "🔄 Starting all services..."
docker-compose up -d --build

# Wait a moment for services to initialize
echo "⏳ Waiting for services to initialize..."
sleep 5

# Check service status
echo "📊 Service Status:"
docker-compose ps

# Check if all services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ ProtChain services started successfully!"
    echo ""
    echo "🌐 Services available at:"
    echo "   - ProtChain API: http://localhost:8082"
    echo "   - BioAPI: http://localhost:8000"
    echo "   - IPFS Gateway: http://localhost:8080"
    echo "   - PostgreSQL: localhost:5432"
    echo ""
    echo "🔍 To view logs: docker-compose logs [service-name]"
    echo "🛑 To stop services: docker-compose down"
else
    echo "⚠️  Some services may not have started correctly."
    echo "📋 Check logs with: docker-compose logs"
fi
