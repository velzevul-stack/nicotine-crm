const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Сохранение файла из Blob: на телефонах надёжнее Web Share API, иначе — <a download> в DOM.
 */
export async function downloadBlobAsFile(blob: Blob, filename: string): Promise<void> {
  const type = blob.type || XLSX_MIME;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type });
      const n = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (typeof n.canShare === 'function' && n.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      /* ниже — запасной вариант */
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
}
