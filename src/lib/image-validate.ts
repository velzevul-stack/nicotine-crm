/**
 * Валидация загружаемых изображений.
 * Проверка magic bytes (сигнатур) — защита от подмены MIME-типа.
 */

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Проверяет magic bytes и возвращает расширение или null.
 */
export function getImageExtensionFromBuffer(buffer: Buffer): '.jpg' | '.png' | '.webp' | null {
  if (buffer.length < 12) return null;

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg';
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return '.png';
  }

  // WebP (RIFF....WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return '.webp';
  }

  return null;
}

/**
 * Проверяет, что buffer — валидное изображение JPEG/PNG/WebP.
 */
export function isValidImageBuffer(buffer: Buffer): boolean {
  return getImageExtensionFromBuffer(buffer) !== null;
}

/** Регулярка для безопасного photoUrl: /uploads/brands/<uuid>.<ext> */
export const SAFE_PHOTO_URL_REGEX =
  /^\/uploads\/brands\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

export function isSafePhotoUrl(url: string): boolean {
  return SAFE_PHOTO_URL_REGEX.test(url);
}
