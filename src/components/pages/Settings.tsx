'use client';

import Link from 'next/link';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ArrowLeft } from 'lucide-react';
import { SettingsTab } from './profile/SettingsTab';

export function Settings() {
  return (
    <>
      <ScreenHeader title="Настройки магазина" subtitle="Управление параметрами" />

      <section className="px-5 pb-6">
        <div className="bg-[#151922] rounded-[20px] overflow-hidden">
          <div
            className="px-5 py-4 border-b"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.08)',
              background: 'linear-gradient(135deg, rgba(191, 231, 229, 0.08) 0%, transparent 100%)',
            }}
          >
            <Link
              href="/profile"
              className="flex items-center gap-2 text-[#F5F5F7] active:scale-95 transition-transform"
            >
              <ArrowLeft size={20} strokeWidth={1.5} />
              <span className="font-semibold">Назад</span>
            </Link>
          </div>

          <div className="p-5">
            <SettingsTab />
          </div>
        </div>
      </section>
    </>
  );
}
