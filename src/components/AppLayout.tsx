'use client';

import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { useStatsSync } from '@/hooks/use-stats-sync';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  useStatsSync();

  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex h-full w-full max-w-md min-h-0 flex-col relative bg-background">
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y pb-24 [-webkit-overflow-scrolling:touch]">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
