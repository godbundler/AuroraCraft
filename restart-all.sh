#!/bin/bash
echo "🔄 Restarting AuroraCraft services..."
echo ""

# Start PostgreSQL
echo "1️⃣ Starting PostgreSQL..."
sudo service postgresql start
sleep 2

# Check PostgreSQL
if pg_isready > /dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL failed to start"
    exit 1
fi

# Start backend
echo ""
echo "2️⃣ Starting backend..."
sudo /workspaces/AuroraCraft/backend.sh start

# Wait for backend
sleep 3

# Check backend health
echo ""
echo "3️⃣ Checking backend health..."
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    exit 1
fi

echo ""
echo "✅ All services started successfully!"
echo ""
echo "Run './status.sh' to see full status"
