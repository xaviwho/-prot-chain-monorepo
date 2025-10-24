#!/bin/bash

# ProtChain Force Rebuild and Start Script
# This script forces a complete rebuild of all containers

echo "🚀 Force rebuilding ProtChain Docker Services..."

# Navigate to the correct directory
cd "$(dirname "$0")"

# Stop and remove all containers, networks, and volumes
echo "🛑 Stopping and removing all containers, networks, and volumes..."
docker-compose down --volumes --remove-orphans

# Remove any dangling images to force fresh builds
echo "🧹 Removing dangling images..."
docker image prune -f

# Force rebuild all services without cache
echo "🔄 Force rebuilding all services (no cache)..."
docker-compose build --no-cache --pull

# Start all services
echo "🚀 Starting all services..."
docker-compose up -d

# Wait a moment for services to initialize
echo "⏳ Waiting for services to initialize..."
sleep 10

# Check service status
echo "📊 Service Status:"
docker-compose ps

# Show logs for protchainapi to verify it's working
echo "📋 ProtChain API logs:"
docker-compose logs --tail=20 protchainapi

# Check if all services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ ProtChain services rebuilt and started successfully!"
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
