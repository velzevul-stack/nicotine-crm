'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/PageHeader';
import { Clock, Gift, Bug } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type AdminSystemSettings = {
  trialDays: number;
  referralRewardDays: number;
  clientErrorLoggingEnabled: boolean;
};

type ClientErrorLogRow = {
  id: string;
  createdAt: string;
  kind: string;
  message: string;
  href: string | null;
  shopId: string | null;
  userId: string | null;
};

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shopData } = useQuery({
    queryKey: ['admin-shop'],
    queryFn: () =>
      api<{ supportTelegramUsername: string | null }>('/api/shop'),
  });

  const { data: systemSettings } = useQuery({
    queryKey: ['admin-system-settings'],
    queryFn: () => api<AdminSystemSettings>('/api/admin/settings'),
  });

  const { data: clientErrorLog, refetch: refetchClientErrors } = useQuery({
    queryKey: ['admin-client-errors'],
    queryFn: () =>
      api<{ rows: ClientErrorLogRow[]; total: number }>('/api/admin/client-errors?limit=30'),
    enabled: !!systemSettings?.clientErrorLoggingEnabled,
  });

  const [telegramUsername, setTelegramUsername] = useState('');
  const [trialDays, setTrialDays] = useState('7');
  const [referralRewardDays, setReferralRewardDays] = useState('14');

  useEffect(() => {
    if (shopData) {
      setTelegramUsername(shopData.supportTelegramUsername?.replace('@', '') || '');
    }
  }, [shopData]);

  useEffect(() => {
    if (systemSettings) {
      setTrialDays(String(systemSettings.trialDays));
      setReferralRewardDays(String(systemSettings.referralRewardDays));
    }
  }, [systemSettings]);

  const updateShopMutation = useMutation({
    mutationFn: (username: string | null) =>
      api<{ supportTelegramUsername: string | null }>('/api/shop', {
        method: 'PATCH',
        body: { supportTelegramUsername: username },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-shop'], data);
      queryClient.setQueryData(['shop'], data);
      queryClient.invalidateQueries({ queryKey: ['admin-shop'] });
      queryClient.invalidateQueries({ queryKey: ['shop'] });
      setTelegramUsername(data.supportTelegramUsername?.replace('@', '') || '');
      toast({ title: 'Настройки сохранены', description: 'Telegram-ник обновлён' });
    },
    onError: (err: any) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    },
  });

  const toggleClientErrorLogging = useMutation({
    mutationFn: (enabled: boolean) =>
      api<AdminSystemSettings>('/api/admin/settings', {
        method: 'PATCH',
        body: { clientErrorLoggingEnabled: enabled },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-system-settings'], data);
      void queryClient.invalidateQueries({ queryKey: ['admin-client-errors'] });
      toast({
        title: data.clientErrorLoggingEnabled ? 'Логи ошибок на сервер включены' : 'Логи ошибок на сервер выключены',
        description: data.clientErrorLoggingEnabled
          ? 'Короткие сообщения об ошибках с сайта будут сохраняться в БД.'
          : 'Новые записи не создаются.',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Не удалось сохранить',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const updateSystemMutation = useMutation({
    mutationFn: (data: { trialDays?: number; referralRewardDays?: number }) =>
      api<AdminSystemSettings>('/api/admin/settings', {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-system-settings'], data);
      setTrialDays(String(data.trialDays));
      setReferralRewardDays(String(data.referralRewardDays));
      void queryClient.invalidateQueries({ queryKey: ['admin-client-errors'] });
      toast({ title: 'Настройки сохранены', description: 'Системные настройки обновлены' });
    },
    onError: (err: any) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    },
  });

  const handleSaveShop = () => {
    const username = telegramUsername.trim();
    const finalUsername = username ? (username.startsWith('@') ? username : `@${username}`) : null;
    updateShopMutation.mutate(finalUsername);
  };

  const handleSaveSystem = () => {
    const td = parseInt(trialDays, 10);
    const rd = parseInt(referralRewardDays, 10);
    if (!td || td < 1 || td > 90) {
      toast({ title: 'Ошибка', description: 'Триал: от 1 до 90 дней', variant: 'destructive' });
      return;
    }
    if (!rd || rd < 1 || rd > 90) {
      toast({ title: 'Ошибка', description: 'Бонус за реферала: от 1 до 90 дней', variant: 'destructive' });
      return;
    }
    updateSystemMutation.mutate({ trialDays: td, referralRewardDays: rd });
  };

  return (
    <>
      <PageHeader title="Настройки" subtitle="Управление настройками системы" />
      
      <div className="max-w-2xl space-y-6">
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Telegram-ник для поддержки
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Укажите ваш Telegram-ник (например: @username). Пользователи смогут написать вам в поддержку через кнопку в профиле.
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={telegramUsername}
                  onChange={(e) => {
                    const value = e.target.value.replace('@', '');
                    setTelegramUsername(value);
                  }}
                  placeholder="username"
                  className="font-mono"
                />
              </div>
              <div className="flex items-center text-muted-foreground">
                @
              </div>
            </div>
            {telegramUsername && (
              <p className="text-xs text-muted-foreground mt-2">
                Ссылка: <a href={`https://t.me/${telegramUsername}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">t.me/{telegramUsername}</a>
              </p>
            )}
          </div>

          <Button
            onClick={handleSaveShop}
            disabled={updateShopMutation.isPending}
            className="w-full"
          >
            {updateShopMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Bug size={18} className="text-amber-500" />
                Логи ошибок с сайта
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                Короткие сообщения (ошибки React, скрипты, необработанные промисы) от всех пользователей. Пишется в БД
                только при включённом переключателе. Для проверки выключите, откройте сайт под пользователем — записей
                быть не должно.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Label htmlFor="client-error-logging" className="text-sm whitespace-nowrap">
                  {systemSettings?.clientErrorLoggingEnabled ? 'Вкл.' : 'Выкл.'}
                </Label>
                <Switch
                  id="client-error-logging"
                  checked={!!systemSettings?.clientErrorLoggingEnabled}
                  onCheckedChange={(v) => toggleClientErrorLogging.mutate(v)}
                  disabled={toggleClientErrorLogging.isPending}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => void refetchClientErrors()}
                disabled={!systemSettings?.clientErrorLoggingEnabled}
              >
                Обновить журнал
              </Button>
            </div>
          </div>

          {systemSettings?.clientErrorLoggingEnabled && (
            <div className="rounded-lg border border-border overflow-x-auto max-h-[280px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Время</th>
                    <th className="text-left p-2 font-medium">Тип</th>
                    <th className="text-left p-2 font-medium">Сообщение</th>
                    <th className="text-left p-2 font-medium">Страница</th>
                  </tr>
                </thead>
                <tbody>
                  {(clientErrorLog?.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-muted-foreground text-center">
                        Пока нет записей. Вызовите тестовую ошибку на сайте (с включённым логированием).
                      </td>
                    </tr>
                  ) : (
                    (clientErrorLog?.rows ?? []).map((r: ClientErrorLogRow) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="p-2 whitespace-nowrap align-top">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="p-2 align-top font-mono">{r.kind}</td>
                        <td className="p-2 align-top break-all max-w-[280px]">{r.message}</td>
                        <td className="p-2 align-top break-all max-w-[200px] text-muted-foreground">
                          {r.href ?? '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {clientErrorLog && clientErrorLog.total > (clientErrorLog.rows?.length ?? 0) && (
                <p className="text-xs text-muted-foreground p-2 border-t">
                  Показано {clientErrorLog.rows.length} из {clientErrorLog.total}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-6 space-y-5">
          <h3 className="text-base font-semibold text-foreground">Подписка и реферальная программа</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                <Clock size={15} className="text-blue-400" />
                Пробный период (дней)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Сколько дней бесплатного доступа для новых пользователей
              </p>
              <Input
                type="number"
                min={1}
                max={90}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                className="font-mono"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                <Gift size={15} className="text-green-400" />
                Бонус за реферала (дней)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Сколько дней подписки начисляется рефереру за оплативших пользователей
              </p>
              <Input
                type="number"
                min={1}
                max={90}
                value={referralRewardDays}
                onChange={(e) => setReferralRewardDays(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <Button
            onClick={handleSaveSystem}
            disabled={updateSystemMutation.isPending}
            className="w-full"
          >
            {updateSystemMutation.isPending ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </div>
      </div>
    </>
  );
}
