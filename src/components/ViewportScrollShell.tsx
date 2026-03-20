import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MaxWidth = 'md' | 'full';

export interface ViewportScrollShellProps {
  children: ReactNode;
  /** Не прокручивается (шапка админки и т.п.) */
  header?: ReactNode;
  /** Под областью скролла, в колонке приложения (например фиксированный таббар) */
  belowScroll?: ReactNode;
  maxWidth?: MaxWidth;
  className?: string;
  mainClassName?: string;
}

/**
 * Фиксированная высота вьюпорта + прокрутка только внутри main — уменьшает «вылеты»
 * Mini App / Safari на iOS при вертикальном скролле (см. overscroll-y-contain).
 */
export function ViewportScrollShell({
  children,
  header,
  belowScroll,
  maxWidth = 'md',
  className,
  mainClassName,
}: ViewportScrollShellProps) {
  const innerMax =
    maxWidth === 'md' ? 'mx-auto w-full max-w-md' : 'w-full min-w-0';

  return (
    <div
      className={cn(
        'fixed inset-0 z-0 flex flex-col overflow-hidden bg-background text-foreground',
        className
      )}
    >
      {header}
      <div
        className={cn(
          'relative flex min-h-0 flex-1 flex-col bg-background',
          innerMax
        )}
      >
        <main
          className={cn(
            'min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]',
            mainClassName
          )}
        >
          {children}
        </main>
        {belowScroll}
      </div>
    </div>
  );
}

/** Центрирование форм входа / ошибок внутри прокручиваемой области */
export const viewportMainCentered =
  'flex min-h-full flex-col items-center justify-center p-4';
