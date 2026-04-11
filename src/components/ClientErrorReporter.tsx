'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-client-error';

export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const msg = event.message || 'Script error';
      if (
        msg.includes('ResizeObserver loop') ||
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module')
      ) {
        return;
      }
      reportClientError({
        message: msg,
        stack: event.error instanceof Error ? event.error.stack : undefined,
        kind: 'runtime',
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const r = event.reason;
      const msg = r instanceof Error ? r.message : String(r);
      if (!msg || msg.includes('Loading chunk')) return;
      reportClientError({
        message: msg || 'Unhandled rejection',
        stack: r instanceof Error ? r.stack : undefined,
        kind: 'unhandledrejection',
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
