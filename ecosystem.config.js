/**
 * PM2 конфигурация для production на VPS.
 * Использование: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'telegram-seller',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
    },
  ],
};
