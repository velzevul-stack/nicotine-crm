'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Box, PenSquare, HandCoins, CircleUser } from 'lucide-react';

const tabs = [
  { id: 'home', path: '/dashboard', icon: LayoutDashboard, label: 'Главная' },
  { id: 'inventory', path: '/inventory', icon: Box, label: 'Склад' },
  { id: 'post', path: '/post', icon: PenSquare, label: 'Пост' },
  { id: 'sale', path: '/sales', icon: HandCoins, label: 'Продажа' },
  { id: 'profile', path: '/profile', icon: CircleUser, label: 'Профиль' },
];

export function BottomNav() {
  const pathname = usePathname();

  const getActiveTab = (tab: (typeof tabs)[0]) => {
    if (pathname === tab.path) return true;
    if (tab.id === 'home' && (pathname === '/' || pathname === '/dashboard')) return true;
    if (tab.id === 'profile' && (pathname?.startsWith('/profile') || pathname?.startsWith('/debts') || pathname?.startsWith('/settings'))) return true;
    return false;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#121212]/85 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-md mx-auto px-6">
        <div className="flex items-center justify-around py-3">
          {tabs.map((tab) => {
            const isActive = getActiveTab(tab);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                href={tab.path}
                className="flex flex-col items-center justify-center gap-1.5 py-2 px-2 relative min-w-[64px] active:scale-95 transition-transform"
              >
                <div className="relative flex flex-col items-center min-h-[44px] justify-center">
                  <div
                    className={`flex items-center justify-center transition-colors duration-200 ${
                      isActive ? 'text-[#BFE7E5]' : 'text-[#9CA3AF]'
                    }`}
                  >
                    <Icon size={22} strokeWidth={1.25} />
                  </div>
                  {isActive && (
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#BFE7E5]"
                      aria-hidden
                    />
                  )}
                </div>
                <span
                  className={`transition-colors text-[0.625rem] font-medium tracking-wide ${
                    isActive ? 'text-[#BFE7E5]' : 'text-[#9CA3AF]'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
