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
    <ViewportScrollShell maxWidth="md" mainClassName="pb-24" belowScroll={<BottomNav />}>
      {children}
    </ViewportScrollShell>
  );
}
