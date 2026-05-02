# PM2 Root User Issue - Resolution

## Problem

After Codespace restart, the backend showed EACCES permission errors when trying to create directories in `/home/auroracraft-*`. 

### Root Causes Discovered

1. **Backend not running as root**: PM2 was spawning processes as the `codespace` user, not root
2. **Multiple PM2 daemons**: Both codespace user and root had PM2 daemons running
3. **PM2 root user bug**: PM2 running as root doesn't properly spawn child processes - shows "online" but no actual process runs

## Solution

**Replaced PM2 with simple bash script** (`backend.sh`)

### Why This Works

- Direct process spawning without PM2's complexity
- Runs as root when invoked with `sudo`
- Simple PID-based process management
- Proper logging to existing log files

### Usage

```bash
# Start backend
sudo ./backend.sh start

# Stop backend
sudo ./backend.sh stop

# Restart backend
sudo ./backend.sh restart

# Check status
sudo ./backend.sh status
```

### After Codespace Restart

Use the updated restart script:

```bash
./restart-all.sh
```

This will:
1. Start PostgreSQL
2. Start backend as root
3. Verify health

## Technical Details

- **PID File**: `/tmp/auroracraft-backend.pid`
- **Process**: tsx wrapper (PID 5685) → node process (PID 5696)
- **User**: root (required for directory creation in `/home/auroracraft-*`)
- **Logs**: `logs/server-out.log` and `logs/server-error.log`

## Files Modified

- `backend.sh` - New backend management script
- `restart-all.sh` - Updated to use backend.sh instead of PM2
- `ecosystem.production.cjs` - No longer used

## Verification

```bash
# Check backend is running as root
ps aux | grep "server/src/index.ts"

# Test health
curl http://localhost:3000/api/health

# Check status
sudo ./backend.sh status
```

---

**Key Lesson**: PM2 has known issues running as root. For applications that require root privileges, use simpler process management or systemd.
