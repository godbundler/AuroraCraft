# PostgreSQL — Start, Connect & Troubleshoot

Quick reference for starting PostgreSQL and reconnecting the AuroraCraft server.

---

## Quick Start (TL;DR)

```bash
# Start PostgreSQL → wait for ready → restart server
pg_ctlcluster 18 main start
pg_isready
pm2 restart auroracraft-server
```

Or use the all-in-one script:

```bash
./start-all.sh
```

---

## 1. Check If PostgreSQL Is Running

```bash
pg_isready
```

| Output | Meaning |
|--------|---------|
| `/var/run/postgresql:5432 - accepting connections` | ✅ Running |
| `/var/run/postgresql:5432 - no response` | ❌ Not running |

You can also check the cluster status:

```bash
pg_lsclusters
```

Expected output when running:

```
Ver Cluster Port Status Owner    Data directory              Log file
18  main    5432 online postgres /var/lib/postgresql/18/main /var/log/postgresql/postgresql-18-main.log
```

If the **Status** column says `down`, PostgreSQL needs to be started.

---

## 2. Start PostgreSQL

### Container / Dev Environment (no systemd)

```bash
pg_ctlcluster 18 main start
```

Wait for it to be ready:

```bash
until pg_isready -q; do echo "Waiting for PostgreSQL..."; sleep 1; done
echo "PostgreSQL is ready."
```

### Standard Linux Server (with systemd)

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql   # auto-start on boot
```

### Using the `service` command (alternative)

```bash
sudo service postgresql start
```

---

## 3. Verify the Database Connection

### Test basic connectivity

```bash
pg_isready
```

### Test the AuroraCraft database with credentials

```bash
PGPASSWORD=auroracraft psql -U auroracraft -d auroracraft -h localhost -c 'SELECT 1;'
```

Expected output:

```
 ?column?
----------
        1
(1 row)
```

### Test using the DATABASE_URL from .env

```bash
psql "postgresql://auroracraft:auroracraft@localhost:5432/auroracraft" -c 'SELECT current_database(), current_user;'
```

Expected output:

```
 current_database | current_user
------------------+--------------
 auroracraft      | auroracraft
```

### Verify all tables exist

```bash
PGPASSWORD=auroracraft psql -U auroracraft -d auroracraft -h localhost -c '\dt'
```

Expected tables:

```
 Schema |      Name      | Type  |    Owner
--------+----------------+-------+-------------
 public | agent_logs     | table | auroracraft
 public | agent_messages | table | auroracraft
 public | agent_sessions | table | auroracraft
 public | projects       | table | auroracraft
 public | sessions       | table | auroracraft
 public | users          | table | auroracraft
```

---

## 4. Restart the AuroraCraft Server

After PostgreSQL is back online, restart the server so it reconnects:

```bash
pm2 restart auroracraft-server
```

Verify the server is healthy:

```bash
curl -s http://localhost:3000/api/health
```

Expected: `{"status":"ok","timestamp":"..."}`

---

## 5. Full Restart Procedure (PostgreSQL + Server)

If everything is down, run these steps in order:

```bash
# Step 1: Start PostgreSQL
pg_ctlcluster 18 main start

# Step 2: Wait for PostgreSQL to accept connections
until pg_isready -q; do echo "Waiting..."; sleep 1; done
echo "PostgreSQL is ready."

# Step 3: (Optional) Run migrations if schema changed
cd /workspaces/AuroraCraft/server
DATABASE_URL="postgresql://auroracraft:auroracraft@localhost:5432/auroracraft" npx tsx src/db/migrate.ts
cd /workspaces/AuroraCraft

# Step 4: Kill any stale server processes
pm2 delete all 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
sleep 2

# Step 5: Start the server
pm2 start ecosystem.config.cjs

# Step 6: Verify
sleep 5
pm2 list
curl -s http://localhost:3000/api/health
```

Or simply use the built-in script which does all of this:

```bash
./start-all.sh
```

---

## 6. Troubleshooting

### PostgreSQL won't start — "stale pid file"

```bash
pg_ctlcluster 18 main start
# Output: "Removed stale pid file."
```

This is normal after an improper shutdown (e.g., container restart). PostgreSQL removes the stale PID file and starts with automatic recovery.

### "role does not exist" or "database does not exist"

Recreate the database and user:

```bash
sudo -u postgres psql <<SQL
CREATE ROLE auroracraft WITH LOGIN PASSWORD 'auroracraft';
CREATE DATABASE auroracraft OWNER auroracraft;
GRANT ALL PRIVILEGES ON DATABASE auroracraft TO auroracraft;
SQL
```

Then run migrations and seed:

```bash
cd /workspaces/AuroraCraft/server
DATABASE_URL="postgresql://auroracraft:auroracraft@localhost:5432/auroracraft" npx tsx src/db/migrate.ts
DATABASE_URL="postgresql://auroracraft:auroracraft@localhost:5432/auroracraft" npx tsx src/db/seed.ts
cd /workspaces/AuroraCraft
```

### Server starts but API returns errors

Check if PostgreSQL is running first:

```bash
pg_isready
```

If PostgreSQL is running but the server still fails, check the logs:

```bash
pm2 logs auroracraft-server --lines 20
# or
tail -20 /workspaces/AuroraCraft/logs/server-error.log
```

### Port 5432 already in use

```bash
# Check what's using the port
fuser 5432/tcp

# If it's an old PostgreSQL process, stop and restart
pg_ctlcluster 18 main stop
pg_ctlcluster 18 main start
```

### Port 3000 already in use (server won't start)

```bash
# Kill anything on port 3000
fuser -k 3000/tcp
sleep 2

# Restart server
pm2 restart auroracraft-server
```

### Check PostgreSQL logs for errors

```bash
tail -30 /var/log/postgresql/postgresql-18-main.log
```

---

## 7. Connection Details

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5432` |
| Database | `auroracraft` |
| User | `auroracraft` |
| Password | `auroracraft` |
| URL | `postgresql://auroracraft:auroracraft@localhost:5432/auroracraft` |
| Config file | `.env` → `DATABASE_URL` |

---

## 8. Useful Commands Reference

```bash
# PostgreSQL status
pg_isready                              # Check if accepting connections
pg_lsclusters                           # Show all clusters and their status

# Start / Stop / Restart PostgreSQL
pg_ctlcluster 18 main start            # Start
pg_ctlcluster 18 main stop             # Stop
pg_ctlcluster 18 main restart          # Restart
pg_ctlcluster 18 main status           # Status

# Connect to database
sudo -u postgres psql                   # Connect as superuser
PGPASSWORD=auroracraft psql -U auroracraft -d auroracraft -h localhost  # Connect as app user

# Server management
pm2 restart auroracraft-server          # Restart server
pm2 logs auroracraft-server             # View server logs
curl -s http://localhost:3000/api/health  # Health check
```
