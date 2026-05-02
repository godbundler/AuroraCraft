#!/bin/bash
# AuroraCraft Operations Quick Reference

echo "=== AuroraCraft Deployment Status ==="
echo ""

# Check PostgreSQL
echo "📊 PostgreSQL Status:"
service postgresql status | head -1
echo ""

# Check PM2
echo "🔄 PM2 Processes:"
pm2 list
echo ""

# Check Backend Health
echo "🏥 Backend Health:"
curl -s http://localhost:3000/api/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/api/health
echo ""

# Check Database
echo "💾 Database Users:"
psql postgresql://auroracraft:auroracraft@localhost:5432/auroracraft -c 'SELECT username, role, created_at FROM users;' 2>/dev/null || echo "Database connection failed"
echo ""

# Check System Users
echo "👥 System Users:"
ls -la /home/ | grep auroracraft | awk '{print $3, $9}'
echo ""

# Check OpenCode
echo "🤖 OpenCode Version:"
opencode --version
echo ""

# Check Port Usage
echo "🔌 OpenCode Port Usage (9000-9999):"
netstat -tuln 2>/dev/null | grep -E "900[0-9]|99[0-9][0-9]" | wc -l
echo "ports in use"
echo ""

# Check Logs
echo "📝 Recent Backend Logs (last 5 lines):"
tail -5 logs/server-out.log 2>/dev/null || echo "No logs yet"
echo ""

echo "=== Quick Commands ==="
echo "Start:    pm2 start ecosystem.production.cjs"
echo "Stop:     pm2 stop all"
echo "Restart:  pm2 restart all"
echo "Logs:     pm2 logs --lines 50"
echo "Monitor:  pm2 monit"
echo ""
