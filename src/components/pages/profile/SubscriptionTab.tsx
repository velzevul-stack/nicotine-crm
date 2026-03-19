'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Calendar, Crown, Gift, Star, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface SubscriptionInfo {
  subscriptionStatus: 'trial' | 'active' | 'expired';
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  referralCode: string | null;
  referralsCount: number;
  activeReferralsCount: number;
}

export function SubscriptionTab() {
  const { data: subscriptionInfo, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api<SubscriptionInfo>('/api/subscription'),
  });

  const { data: referralsData } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api<{ referralLink: string | null }>('/api/referrals'),
    enabled: !!subscriptionInfo?.referralCode,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[#9CA3AF]">Загрузка...</div>
      </div>
    );
  }

  if (!subscriptionInfo) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[#9CA3AF]">Ошибка загрузки данных</div>
      </div>
    );
  }

  const now = new Date();
  const isTrial = subscriptionInfo.subscriptionStatus === 'trial';
  const isActive = subscriptionInfo.subscriptionStatus === 'active';
  const isExpired = subscriptionInfo.subscriptionStatus === 'expired';

  const trialEndsAt = subscriptionInfo.trialEndsAt ? new Date(subscriptionInfo.trialEndsAt) : null;
  const subscriptionEndsAt = subscriptionInfo.subscriptionEndsAt ? new Date(subscriptionInfo.subscriptionEndsAt) : null;

  const isTrialExpired = trialEndsAt && trialEndsAt < now;
  const isSubscriptionExpired = subscriptionEndsAt && subscriptionEndsAt < now;
  const daysRemaining = subscriptionEndsAt
    ? Math.max(0, Math.ceil((subscriptionEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const referralLink = referralsData?.referralLink ||
    (subscriptionInfo.referralCode
      ? `https://t.me/your_bot?start=${subscriptionInfo.referralCode}`
      : null);

  return (
    <div className="space-y-4">
      {/* Статус подписки — пастельная карточка */}
      <div className="bg-[#F2D6DE] rounded-[20px] p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2 text-[#111111]">Статус подписки</h3>
            <div className="flex items-center gap-2">
              {isActive && !isSubscriptionExpired ? (
                <>
                  <CheckCircle2 size={20} className="text-[#111111]" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-[#111111]">Активна</span>
                </>
              ) : isTrial && !isTrialExpired ? (
                <>
                  <Clock size={20} className="text-[#111111]" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-[#111111]">Пробный период</span>
                </>
              ) : (
                <>
                  <AlertCircle size={20} className="text-[#111111]" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-[#111111]">Истекла</span>
                </>
              )}
            </div>
          </div>
          <div className="p-2 rounded-[12px]" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}>
            <Crown size={24} className="text-[#111111]" strokeWidth={1.5} />
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-black/10">
          {isTrial && trialEndsAt && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#1A1A1A] opacity-70" strokeWidth={1.5} />
                <span className="text-sm text-[#1A1A1A] opacity-70">Пробный период до:</span>
              </div>
              <span className={`text-sm font-medium ${isTrialExpired ? 'text-[#111111]' : 'text-[#111111]'}`}>
                {format(trialEndsAt, 'dd MMMM yyyy', { locale: ru })}
              </span>
            </div>
          )}

          {subscriptionEndsAt && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#1A1A1A] opacity-70" strokeWidth={1.5} />
                <span className="text-sm text-[#1A1A1A] opacity-70">Подписка до:</span>
              </div>
              <span className="text-sm font-medium text-[#111111]">
                {format(subscriptionEndsAt, 'dd MMMM yyyy', { locale: ru })}
              </span>
            </div>
          )}

          {(isActive || isTrial) && daysRemaining > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-black/10">
              <span className="text-sm text-[#1A1A1A] opacity-70">Осталось дней:</span>
              <span className="text-lg font-bold text-[#111111]">{daysRemaining}</span>
            </div>
          )}
        </div>
      </div>

      {/* Реферальная программа */}
      {subscriptionInfo.referralCode && (
        <div className="bg-[#1B2030] rounded-[16px] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={18} className="text-[#BFE7E5]" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[#F5F5F7]">Реферальная программа</h3>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-[12px] bg-[#151922] border border-white/10">
                <p className="text-xs text-[#9CA3AF] mb-1">Всего рефералов</p>
                <p className="text-xl font-bold text-[#F5F5F7]">{subscriptionInfo.referralsCount}</p>
              </div>
              <div className="p-3 rounded-[12px] bg-[#151922] border border-white/10">
                <p className="text-xs text-[#9CA3AF] mb-1">С подпиской</p>
                <p className="text-xl font-bold text-[#BFE7E5]">{subscriptionInfo.activeReferralsCount}</p>
              </div>
            </div>

            {subscriptionInfo.activeReferralsCount > 0 && (
              <div className="p-3 rounded-[12px] bg-[#BFE7E5]/20 border border-[#BFE7E5]/30">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-[#BFE7E5]" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-[#BFE7E5]">
                    Бесплатных месяцев: <strong className="text-[#F5F5F7]">{subscriptionInfo.activeReferralsCount}</strong>
                  </span>
                </div>
              </div>
            )}

            {referralLink && (
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-[#9CA3AF] mb-2">Реферальная ссылка:</p>
                <div className="p-2 rounded-[12px] bg-[#151922] border border-white/10">
                  <code className="text-xs font-mono break-all text-[#F5F5F7]">{referralLink}</code>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Информация о покупке подписки */}
      {(isExpired || (isTrial && isTrialExpired)) && (
        <div className="bg-[#1B2030] rounded-[16px] p-4 border border-[#BFE7E5]/20">
          <div className="flex items-start gap-3">
            <Crown size={20} className="text-[#BFE7E5] mt-0.5" strokeWidth={1.5} />
            <div className="flex-1">
              <h4 className="font-semibold mb-1 text-[#F5F5F7]">Продлить подписку</h4>
              <p className="text-sm text-[#9CA3AF] mb-3">
                Используйте команду /subscribe в Telegram боте для покупки подписки через звёзды.
              </p>
              <p className="text-xs text-[#9CA3AF]">
                При покупке подписки ваш пригласивший (если есть) получит бесплатный месяц!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
