# Restart Notes

## Issue After Codespace Restart

After restarting the GitHub Codespace, the backend was still showing EACCES permission errors even though:
- PostgreSQL was running ✅
- PM2 showed the process as "online" ✅
- Health endpoint responded ✅

## Root Cause

The backend process (PID 1560) started at **10:01:41** - BEFORE we ran `pm2 resurrect` at **10:07:09**.

This meant the process was running **old code** from before the Codespace restart, not the fixed code with the OpenCode and Kiro permission fixes.

## Solution

**Always restart PM2 processes after a Codespace restart:**

```bash
# After starting PostgreSQL and PM2
pm2 restart all
pm2 save
```

This ensures the backend loads the latest code with all fixes applied.

## Updated Restart Procedure

1. **Start PostgreSQL:**
   ```bash
   sudo service postgresql start
   ```

2. **Restore PM2 processes:**
   ```bash
   pm2 resurrect
   ```

3. **Restart to load latest code:**
   ```bash
   pm2 restart all
   pm2 save
   ```

4. **Verify:**
   ```bash
   ./status.sh
   ```

## Quick Restart Script

Use `./restart-all.sh` which now includes the restart step.

---

**Key Lesson:** `pm2 resurrect` restores saved processes but may use cached code. Always `pm2 restart all` after a system restart to ensure latest code is loaded.
