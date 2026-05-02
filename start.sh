#!/bin/bash
set -e

echo "🚀 Starting AuroraCraft..."

# Setup Cloudflare tunnel
echo "🌐 Setting up Cloudflare tunnel..."
sudo cloudflared service uninstall 2>/dev/null || true
sudo cloudflared service install eyJhIjoiOWNiYTJmOWFiY2ZhMzA2NTExNWUyZThlMTUxYjNhZmQiLCJ0IjoiNTQ5M2FkOTgtNjViNC00NzI0LWEzYTQtZjVkMzY1N2QyMWRkIiwicyI6Ik1EUTRPRFJrTldFdE9XUm1aQzAwTldReUxXRmtOelV0WWpVM09UY3daR0ptTVdVNSJ9
sleep 2

# Start PostgreSQL
echo "📦 Starting PostgreSQL..."
sudo service postgresql start
sleep 2

# Start backend
echo "⚙️  Starting backend server..."
cd /workspaces/AuroraCraft
nohup tsx server/src/index.ts >> logs/server-out.log 2>> logs/server-error.log < /dev/null &
sleep 4

# Check health
echo "🔍 Checking backend health..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Backend is running on http://localhost:3000"
else
    echo "❌ Backend failed to start. Check logs/server-error.log"
    exit 1
fi

echo "✨ AuroraCraft is ready!"
