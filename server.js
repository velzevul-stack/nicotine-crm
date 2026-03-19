// Загружаем переменные окружения из .env файла
require('dotenv').config();

const { createServer } = require('https');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '127.0.0.1';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port, turbopack: false });
const handle = app.getRequestHandler();

// Пути к сертификатам (создаются через mkcert)
const certPath = path.join(__dirname, 'localhost.pem');
const keyPath = path.join(__dirname, 'localhost-key.pem');

app.prepare().then(() => {
  // Проверяем наличие сертификатов
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error('❌ SSL сертификаты не найдены!');
    console.error('📝 Создайте сертификаты с помощью mkcert:');
    console.error('   1. Установите mkcert: https://github.com/FiloSottile/mkcert');
    console.error('   2. Выполните: mkcert -install');
    console.error('   3. Выполните: mkcert localhost 127.0.0.1');
    console.error('   4. Переименуйте файлы в localhost.pem и localhost-key.pem');
    process.exit(1);
  }

  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  createServer(httpsOptions, async (req, res) => {
    try {
      // Используем WHATWG URL API вместо устаревшего url.parse()
      // Формируем базовый URL правильно - если host уже содержит порт, используем его, иначе добавляем порт
      const host = req.headers.host || `${hostname}:${port}`;
      const baseUrl = host.includes(':') ? `https://${host}` : `https://${host}:${port}`;
      const url = new URL(req.url || '/', baseUrl);
      const parsedUrl = {
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams),
        search: url.search,
        hash: url.hash,
      };
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> ✅ Ready on https://${hostname}:${port}`);
    console.log(`> 📱 Используйте этот URL для Telegram Mini App и webhook`);
  });
});
