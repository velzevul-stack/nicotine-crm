/**
 * Должен быть первым import в entrypoint-скриптах (polling и т.д.).
 * Иначе любой import, тянущий @/lib/db/data-source, зафиксирует пустой DB_PASSWORD до dotenv.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
