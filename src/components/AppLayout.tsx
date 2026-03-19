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
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <div className="max-w-md mx-auto min-h-screen relative bg-background">
        <main className="flex-1 pb-24 overflow-y-auto">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
