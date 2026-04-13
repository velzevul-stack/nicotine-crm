/**
 * Разрешение камеры без лишних вызовов getUserMedia.
 *
 * Практика: не вызывать getUserMedia «вхолостую» параллельно со сканером (html5-qrcode) —
 * иначе на части браузеров возможны лишние диалоги или гонки (см. обсуждения вроде
 * https://stackoverflow.com/questions/71701906 — там наоборот отключают rememberLastUsedCamera,
 * у нас цель — один реальный запрос потока у сканера).
 *
 * Permissions API для `camera` поддерживается в Chromium; в Firefox/Safari часто
 * query бросает или даёт unknown — тогда полагаемся на одно открытие камеры из ScanModal.
 */

export type CameraPermissionUiState = 'granted' | 'prompt' | 'denied' | 'unknown';

function mapState(state: PermissionState): CameraPermissionUiState {
  if (state === 'granted' || state === 'denied' || state === 'prompt') return state;
  return 'unknown';
}

/** Однократный запрос состояния (без getUserMedia). */
export async function queryCameraPermissionState(): Promise<CameraPermissionUiState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return mapState(status.state);
  } catch {
    return 'unknown';
  }
}

/**
 * Подписка на смену разрешения (пользователь поменял в настройках сайта).
 * Возвращает функцию отписки.
 */
export async function watchCameraPermission(onChange: (state: CameraPermissionUiState) => void): Promise<() => void> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    onChange('unknown');
    return () => {};
  }
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
    const sync = () => onChange(mapState(status.state));
    sync();
    status.addEventListener('change', sync);
    return () => status.removeEventListener('change', sync);
  } catch {
    onChange('unknown');
    return () => {};
  }
}
