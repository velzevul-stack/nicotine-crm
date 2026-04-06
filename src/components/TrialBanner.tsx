'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Crown, Clock, X } from 'lucide-react';

interface TrialBannerProps {
  subscriptionStatus: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  isAdmin: boolean;
}

export function TrialBanner({
  subscriptionStatus,
  trialEndsAt,
  subscriptionEndsAt,
  isAdmin,
}: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (isAdmin || dismissed) return null;

  const now = new Date();

  if (subscriptionStatus === 'trial' && trialEndsAt) {
    const trialEnd = new Date(trialEndsAt);
    const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    if (daysLeft <= 0) {
      return (
        <div className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
          <Clock size={20} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">
            Пробный период закончился. Оформите подписку для продолжения работы.
          </p>
          <Link
            href="/profile?section=subscription"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors"
          >
            Оформить подписку
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1 rounded-md hover:bg-red-500/20 text-red-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      );
    }

    return (
      <div className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
        <Crown size={20} className="text-amber-400 shrink-0" />
        <p className="text-sm text-amber-200 flex-1">
          Пробный период: <strong>{daysLeft}</strong> {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'} осталось. Оформите подписку!
        </p>
        <Link
          href="/profile?section=subscription"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors"
        >
          Оформить подписку
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded-md hover:bg-amber-500/20 text-amber-400 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  if (subscriptionStatus === 'expired') {
    return (
      <div className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
        <Clock size={20} className="text-red-400 shrink-0" />
        <p className="text-sm text-red-300 flex-1">
          Пробный период закончился. Оформите подписку для продолжения работы.
        </p>
        <Link
          href="/profile?section=subscription"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors"
        >
          Оформить подписку
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded-md hover:bg-red-500/20 text-red-400 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return null;
}
