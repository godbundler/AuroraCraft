const path = require('path')

const ROOT = __dirname
const LOGS = path.resolve(ROOT, 'logs')

module.exports = {
  apps: [
    {
      name: 'auroracraft-server',
      cwd: ROOT,
      script: '/usr/local/share/nvm/versions/node/v24.11.1/bin/tsx',
      args: 'server/src/index.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      wait_ready: false,
      restart_delay: 3000,
      kill_timeout: 10000,
      max_restarts: 10,
      min_uptime: 5000,
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.resolve(LOGS, 'server-error.log'),
      out_file: path.resolve(LOGS, 'server-out.log'),
      merge_logs: true,
    },
  ],
}
