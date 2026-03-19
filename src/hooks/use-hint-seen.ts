'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'hint-seen-';

export function useHintSeen(screenId: string): [boolean, () => void] {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      const key = STORAGE_PREFIX + screenId;
      const seen = typeof window !== 'undefined' && localStorage.getItem(key);
      setShowHint(!seen);
    } catch {
      setShowHint(true);
    }
  }, [screenId]);

  const markSeen = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_PREFIX + screenId, '1');
        setShowHint(false);
      }
    } catch {
      // ignore
    }
  }, [screenId]);

  useEffect(() => {
    return () => {
      markSeen();
    };
  }, [markSeen]);

  return [showHint, markSeen];
}
