# AuroraCraft Production Deployment Summary

**Deployment Date:** 2026-04-25  
**Environment:** Container (Debian-based)  
**Status:** ✅ DEPLOYED

---

## Deployment Configuration

### System Components
- **Node.js:** v24.11.1
- **npm:** 11.13.0
- **PostgreSQL:** 18.3
- **OpenCode:** 1.14.24
- **PM2:** 6.0.14

### Database
- **Database:** `auroracraft`
- **User:** `auroracraft`
- **Connection:** `postgresql://auroracraft:auroracraft@localhost:5432/auroracraft`
- **Tables:** 6 (users, sessions, projects, agent_sessions, agent_messages, agent_logs)
- **Users:** 3 registered users

### Process Management
- **PM2 Config:** `ecosystem.production.cjs`
- **Backend Process:** Running on port 3000 via tsx (TypeScript executor)
- **Auto-restart:** Enabled (PM2 saved configuration)
- **Memory Limit:** 1GB per process
- **Logs:** `/workspaces/AuroraCraft/logs/`

### OpenCode Integration
- **Mode:** On-demand per-project instances
- **Port Range:** 9000-9999
- **Idle Timeout:** 120 seconds (2 minutes)
- **No global process** — Each AI message spawns a fresh instance

### User Isolation
- **System Users:** Created per app user (`auroracraft-{username}`)
- **Home Directories:** `/home/auroracraft-{username}/`
- **Permissions:** 750 (owner rwx, group r-x, others ---)
- **Isolation:** ✅ Verified — users cannot access each other's files

---

## Environment Variables (.env)

```env
DATABASE_URL=postgresql://auroracraft:auroracraft@localhost:5432/auroracraft
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
SESSION_SECRET=d27408875e45aedaa26dcb7eadcd935cae45dd51e4fcd9f7db9691d75ad02bd8
COOKIE_DOMAIN=localhost
CLIENT_URL=http://localhost:5173
OPENCODE_PORT_MIN=9000
OPENCODE_PORT_MAX=9999
OPENCODE_IDLE_TIMEOUT=120000
```

---

## Security Measures

✅ **Secrets Management**
- All credentials in `.env` file
- Session secret: 64-character random string
- Database password: Configured

✅ **User Isolation**
- Each user has isolated Linux system account
- Home directory permissions: 750
- Cross-user access blocked
- OpenCode instances run as user's system account

✅ **File Permissions**
- User home directories: 750 (drwxr-x---)
- Application files: Proper ownership
- Logs directory: Created with appropriate permissions

---

## API Endpoints

### Health Check
```bash
curl http://localhost:3000/api/health
# Response: {"status":"ok","timestamp":"2026-04-25T09:01:31.674Z"}
```

### Authentication
- `/api/auth/register` — User registration
- `/api/auth/login` — User login
- `/api/auth/logout` — User logout
- `/api/auth/me` — Current user info

### Projects
- `/api/projects` — List user projects
- `/api/projects/:id` — Get project details
- `/api/projects/:id/files` — File tree
- `/api/projects/:id/files/content` — Read file

### AI Agent
- `/api/projects/:id/agent/sessions` — List sessions
- `/api/projects/:id/agent/sessions/:sessionId` — Get session
- `/api/projects/:id/agent/sessions/:sessionId/messages` — Send message
- `/api/projects/:id/agent/sessions/:sessionId/stream` — SSE stream

---

## PM2 Commands

```bash
# View processes
pm2 list

# View logs
pm2 logs
pm2 logs --lines 50

# Restart
pm2 restart all
pm2 restart ecosystem.production

# Stop
pm2 stop all

# Start
pm2 start ecosystem.production.cjs

# Save configuration
pm2 save

# Monitor
pm2 monit
```

---

## Port Allocation

### Fixed Ports
- **3000** — Backend API server

### Dynamic Ports (OpenCode)
- **9000-9999** — Per-project OpenCode instances
- Allocated on-demand when AI message is sent
- Released after 2-minute idle timeout
- Prevents port conflicts across concurrent projects

---

## Known Issues & Limitations

### Container Environment
- **No systemd:** Using `service` commands instead
- **PM2 startup:** Configured but requires manual start after container restart
- **PostgreSQL:** Must be started manually via `service postgresql start`

### Build System
- **Frontend build:** Not completed due to npm workspace issues
- **Workaround:** Using tsx to run TypeScript directly
- **Production:** Should build frontend and serve static files

### Kiro CLI Integration
- **Requires root:** `runuser` command needs root privileges
- **Current status:** Kiro bridge implemented but may fail without root
- **Recommendation:** Run backend as root or configure sudo permissions

---

## Verification Checklist

✅ PostgreSQL running and accessible  
✅ Database created with all tables  
✅ Backend running on port 3000  
✅ PM2 process manager active  
✅ Health endpoint responding  
✅ Environment variables configured  
✅ User isolation working  
✅ OpenCode available  
✅ Logs directory created  
✅ PM2 configuration saved  

---

## Next Steps for Production

1. **Build Frontend**
   - Fix npm workspace dependencies
   - Run `npm run build`
   - Serve static files from `client/dist`

2. **Configure Reverse Proxy**
   - Set up Nginx/Caddy
   - SSL/TLS certificates
   - Domain configuration

3. **Security Hardening**
   - Change default admin password
   - Rotate session secret
   - Configure firewall rules
   - Set up fail2ban

4. **Monitoring**
   - Set up log aggregation
   - Configure alerts
   - Monitor OpenCode instance count
   - Track port usage

5. **Backup Strategy**
   - Database backups
   - User home directories
   - Configuration files

6. **Auto-Start on Reboot**
   - Create systemd service (if available)
   - Or use cron @reboot with `start-all.sh`

---

## Troubleshooting

### Backend won't start
```bash
pm2 logs ecosystem.production --lines 50
# Check for port conflicts, database connection issues
```

### Database connection failed
```bash
service postgresql status
psql postgresql://auroracraft:auroracraft@localhost:5432/auroracraft -c 'SELECT 1'
```

### OpenCode instance stuck
```bash
# Check running instances
ps aux | grep opencode
# Kill stuck processes
pkill -f "opencode serve"
```

### Port allocation exhausted
```bash
# Check used ports
netstat -tuln | grep -E "900[0-9]|99[0-9][0-9]"
# Restart backend to reset port manager
pm2 restart all
```

---

## Contact & Support

For issues or questions, refer to:
- Application logs: `/workspaces/AuroraCraft/logs/`
- PM2 logs: `pm2 logs`
- Database logs: `/var/log/postgresql/`

---

**Deployment completed successfully! 🚀**
