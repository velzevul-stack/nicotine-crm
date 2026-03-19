const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status?: number;
}

export class ApiException extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.errors = errors;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { body?: unknown } = {}
): Promise<T> {
  const { body, ...rest } = options;
  
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
      body: body !== undefined ? JSON.stringify(body) : (options.body as BodyInit),
    });

    // Читаем JSON один раз
    let jsonData: any = null;
    try {
      jsonData = await res.json();
    } catch {
      // Если не удалось распарсить JSON
    }

    if (!res.ok) {
      const message = (jsonData as ApiError)?.message || res.statusText || `HTTP ${res.status}`;
      const errors = (jsonData as ApiError)?.errors;
      
      // Логируем ошибку в development
      if (process.env.NODE_ENV === 'development') {
        console.error(`API Error [${res.status}]:`, path, message, errors);
      }

      throw new ApiException(message, res.status, errors);
    }

    return jsonData as T;
  } catch (error) {
    // Если это уже ApiException, пробрасываем дальше
    if (error instanceof ApiException) {
      throw error;
    }

    // Если это ошибка сети или другая ошибка
    if (error instanceof Error) {
      // Логируем в development
      if (process.env.NODE_ENV === 'development') {
        console.error('API Network Error:', path, error.message);
      }
      throw new ApiException(
        error.message || 'Ошибка сети. Проверьте подключение к интернету.',
        0
      );
    }

    // Неизвестная ошибка
    throw new ApiException('Произошла неизвестная ошибка', 0);
  }
}
