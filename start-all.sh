#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== AuroraCraft Deployment ==="

# 1. Start PostgreSQL
echo "[1/6] Starting PostgreSQL..."
sudo service postgresql start
until pg_isready -q; do
  echo "  Waiting for PostgreSQL..."
  sleep 1
done
echo "  PostgreSQL is ready."

# 2. Install dependencies
echo "[2/6] Installing dependencies..."
npm install --silent
echo "  Dependencies installed."

# 3. Build client and server
echo "[3/6] Building client and server..."
if [ ! -d "client/dist" ] || [ "$1" = "--rebuild" ]; then
  npm run build --workspace=client
  echo "  Client built."
else
  echo "  Client already built (use --rebuild to force)."
fi

if [ ! -d "server/dist" ] || [ "$1" = "--rebuild" ]; then
  npm run build --workspace=server
  echo "  Server built."
else
  echo "  Server already built (use --rebuild to force)."
fi

# 4. Run database migrations
echo "[4/6] Running database migrations..."
cd server
DATABASE_URL=$(grep DATABASE_URL "$SCRIPT_DIR/.env" 2>/dev/null | cut -d '=' -f2- || echo "")
if [ -z "$DATABASE_URL" ]; then
  echo "  WARNING: DATABASE_URL not found in .env, skipping migrations."
else
  DATABASE_URL="$DATABASE_URL" npx tsx src/db/migrate.ts
  echo "  Migrations complete."
fi
cd "$SCRIPT_DIR"

# 5. Seed database (only if no admin user exists)
echo "[5/6] Seeding database..."
cd server
if [ -n "$DATABASE_URL" ]; then
  DATABASE_URL="$DATABASE_URL" npx tsx src/db/seed.ts 2>&1 || echo "  Seed skipped (admin may already exist)."
fi
cd "$SCRIPT_DIR"

# 6. Create logs directory and start PM2
echo "[6/6] Starting PM2 processes..."
mkdir -p logs
pm2 delete auroracraft-server 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

# Verify
sleep 3
pm2 list
echo ""
echo "=== AuroraCraft is running ==="
echo "  Server: http://0.0.0.0:3000"
echo "  Admin:  username=admin password=admin123"
echo ""
echo "  Logs:   pm2 logs auroracraft-server"
echo "  Stop:   pm2 stop auroracraft-server"
echo "  Restart: pm2 restart auroracraft-server"
