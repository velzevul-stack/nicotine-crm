'use client';

import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { ViewportScrollShell } from './ViewportScrollShell';
import { useStatsSync } from '@/hooks/use-stats-sync';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  useStatsSync();

  return (
    <ViewportScrollShell
      maxWidth="md"
      mainClassName="pb-24 [scroll-padding-bottom:calc(6.5rem+env(safe-area-inset-bottom,0px))]"
      belowScroll={<BottomNav />}
    >
      {children}
    </ViewportScrollShell>
  );
}
