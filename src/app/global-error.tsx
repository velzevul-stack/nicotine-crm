'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Global error:', error);
    }
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          height: '100%',
          overflow: 'hidden',
          overscrollBehavior: 'none',
          fontFamily: 'system-ui, sans-serif',
          background: '#0f0f0f',
          color: '#fff',
        }}
      >
        <div
          style={{
            position: 'fixed',
            inset: 0,
            overflowY: 'auto',
            overscrollBehaviorY: 'contain',
            WebkitOverflowScrolling: 'touch',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <h2 style={{ marginBottom: 16, fontSize: 18 }}>Произошла ошибка</h2>
          <p style={{ marginBottom: 24, color: '#888', fontSize: 14 }}>
            Произошла непредвиденная ошибка. Попробуйте обновить страницу.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                background: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Попробовать снова
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
        </div>
      </body>
    </html>
  );
}
