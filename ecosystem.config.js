/**
 * PM2 конфигурация для production на VPS.
 * Использование: pm2 start ecosystem.config.js
 *
 * Polling-бот запускается отдельным процессом (webhook не используется).
 *
 * Next.js при `next start` сам читает `.env` из cwd (каталог проекта) — держите один
 * актуальный `.env` в корне, без дублирующихся ключей.
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
      env: { NODE_ENV: 'production', PORT: 3000 },
      max_memory_restart: '500M',
    },
    {
      name: 'telegram-bot-polling',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/scripts/telegram-bot-polling.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
  ],
};
