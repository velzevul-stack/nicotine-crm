'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Copy, Users, Gift, Star } from 'lucide-react';

interface Referral {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  subscriptionStatus: 'trial' | 'active' | 'expired';
  subscriptionEndsAt: Date | null;
  createdAt: Date;
}

interface ReferralsData {
  referralCode: string | null;
  referralLink: string | null;
  totalReferrals: number;
  activeSubscriptions: number;
  referrals: Referral[];
}

export function ReferralsTab() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api<ReferralsData>('/api/referrals'),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Скопировано',
      description: 'Реферальная ссылка скопирована в буфер обмена',
    });
  };

  const getStatusBadge = (status: string, endsAt: Date | null) => {
    const now = new Date();
    const isActive = status === 'active' && endsAt && new Date(endsAt) > now;

    if (isActive) {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-[#BFE7E5]/30 text-[#BFE7E5]">
          Активна
        </span>
      );
    } else if (status === 'trial') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-[#DED8F6]/30 text-[#DED8F6]">
          Триал
        </span>
      );
    } else {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-[#6B7280]/30 text-[#9CA3AF]">
          Истекла
        </span>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[#9CA3AF]">Загрузка...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[#9CA3AF]">Ошибка загрузки данных</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Статистика — пастельные карточки */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#CFE6F2] rounded-[20px] p-5 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[14px] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(207, 230, 242, 0.5)' }}
          >
            <Users size={18} className="text-[#111111]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs text-[#1A1A1A] opacity-70">Всего рефералов</p>
            <p className="text-lg font-bold text-[#111111]">{data.totalReferrals}</p>
          </div>
        </div>
        <div className="bg-[#DED8F6] rounded-[20px] p-5 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[14px] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(222, 216, 246, 0.5)' }}
          >
            <Star size={18} className="text-[#111111]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs text-[#1A1A1A] opacity-70">С подпиской</p>
            <p className="text-lg font-bold text-[#111111]">{data.activeSubscriptions}</p>
          </div>
        </div>
      </div>

      {/* Реферальная ссылка */}
      {data.referralCode && (
        <div className="bg-[#1B2030] rounded-[16px] p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-2 block">
              Реферальная программа
            </label>
            <p className="text-sm text-[#9CA3AF] mb-3">
              Приглашайте друзей! Когда они купят подписку, вы получите бесплатный месяц использования.
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Ваш реферальный код</label>
              <div className="flex items-center gap-2">
                <input
                  value={data.referralCode}
                  readOnly
                  className="flex-1 py-2.5 px-4 rounded-[12px] bg-[#151922] border border-white/10 text-[#F5F5F7] text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(data.referralCode!)}
                  className="p-2.5 rounded-[12px] bg-[#1B2030] border border-white/10 text-[#F5F5F7] hover:bg-[#151922] transition-colors"
                >
                  <Copy size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {data.referralLink && (
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Реферальная ссылка</label>
                <div className="flex items-center gap-2">
                  <input
                    value={data.referralLink}
                    readOnly
                    className="flex-1 py-2.5 px-4 rounded-[12px] bg-[#151922] border border-white/10 text-[#F5F5F7] text-xs font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(data.referralLink!)}
                    className="p-2.5 rounded-[12px] bg-[#1B2030] border border-white/10 text-[#F5F5F7] hover:bg-[#151922] transition-colors"
                  >
                    <Copy size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Список рефералов */}
      {data.referrals.length > 0 ? (
        <div className="bg-[#1B2030] rounded-[16px] p-4">
          <label className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-4 block">
            Ваши рефералы
          </label>
          <div className="space-y-2">
            {data.referrals.map((referral) => {
              const name = referral.firstName || referral.username || 'Без имени';
              return (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 rounded-[12px] bg-[#151922] border border-white/10"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#F5F5F7]">{name}</p>
                    <p className="text-xs text-[#9CA3AF]">
                      Зарегистрирован: {new Date(referral.createdAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="ml-4">
                    {getStatusBadge(referral.subscriptionStatus, referral.subscriptionEndsAt)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-[#1B2030] rounded-[16px] p-8 text-center">
          <Gift size={48} className="mx-auto mb-4 text-[#6B7280] opacity-50" strokeWidth={1.5} />
          <p className="text-sm text-[#9CA3AF] mb-2">У вас пока нет рефералов</p>
          <p className="text-xs text-[#9CA3AF]">
            Поделитесь реферальной ссылкой с друзьями, чтобы начать зарабатывать бесплатные месяцы подписки!
          </p>
        </div>
      )}
    </div>
  );
}
