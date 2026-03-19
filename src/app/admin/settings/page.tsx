'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/PageHeader';

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shopData } = useQuery({
    queryKey: ['admin-shop'],
    queryFn: () =>
      api<{ supportTelegramUsername: string | null }>('/api/shop'),
  });

  const [telegramUsername, setTelegramUsername] = useState('');

  useEffect(() => {
    if (shopData) {
      setTelegramUsername(shopData.supportTelegramUsername?.replace('@', '') || '');
    }
  }, [shopData]);

  const updateMutation = useMutation({
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
      // Обновляем локальное состояние
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

  const handleSave = () => {
    const username = telegramUsername.trim();
    const finalUsername = username ? (username.startsWith('@') ? username : `@${username}`) : null;
    updateMutation.mutate(finalUsername);
  };

  return (
    <>
      <PageHeader title="Настройки" subtitle="Управление настройками системы" />
      
      <div className="max-w-2xl">
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
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </>
  );
}
