/**
 * Удаляет каталог .next (кэш/артефакты сборки Next.js).
 * На сервере: node scripts/clean-next-cache.mjs && npm run build && pm2 restart telegram-seller
 */
import { rm } from 'node:fs/promises';

try {
  await rm('.next', { recursive: true, force: true });
} catch (e) {
  if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
    /* ok */
  } else {
    throw e;
  }
}
console.log('.next cache cleared');
