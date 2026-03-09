module.exports = {
  apps: [
    {
      name: 'auroracraft-postgres',
      script: 'bash',
      args: '-c "sudo service postgresql start && sleep infinity"',
      autorestart: true,
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/workspaces/AuroraCraft/logs/postgres-error.log',
      out_file: '/workspaces/AuroraCraft/logs/postgres-out.log',
      merge_logs: true,
    },
    {
      name: 'auroracraft-server',
      cwd: '/workspaces/AuroraCraft',
      script: 'node_modules/.bin/tsx',
      args: 'server/src/index.ts',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      wait_ready: false,
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/workspaces/AuroraCraft/logs/server-error.log',
      out_file: '/workspaces/AuroraCraft/logs/server-out.log',
      merge_logs: true,
    },
  ],
}
