'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { ViewportScrollShell, viewportMainCentered } from '@/components/ViewportScrollShell';
import { cn } from '@/lib/utils';

export default function SubscriptionExpiredPage() {
  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () =>
      api<{ supportTelegramUsername: string | null }>('/api/shop'),
  });

  const telegramUsername = shopData?.supportTelegramUsername?.replace('@', '');

  return (
    <ViewportScrollShell maxWidth="md" mainClassName={cn(viewportMainCentered, 'p-6')}>
      <div className="w-full max-w-md bg-card rounded-[24px] p-8 border border-border">
        <div className="flex flex-col items-center text-center">
          <div className="p-4 bg-destructive/20 rounded-[20px] mb-4">
            <AlertCircle size={40} className="text-destructive" strokeWidth={1.5} />
          </div>
          <h1 className="text-foreground text-xl font-semibold mb-2">
            Подписка истекла
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Ваш пробный период или подписка закончились
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Для продолжения использования сервиса необходимо продлить подписку.
            {telegramUsername ? (
              <> Свяжитесь с поддержкой для получения доступа.</>
            ) : (
              <> Обратитесь к администратору для получения доступа.</>
            )}
          </p>

          <div className="flex flex-col gap-3 w-full">
            {telegramUsername && (
              <Button asChild className="w-full">
                <a
                  href={`https://t.me/${telegramUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Написать в поддержку
                </a>
              </Button>
            )}
            <Button variant="outline" asChild className="w-full">
              <Link href="/login">Выйти</Link>
            </Button>
          </div>
        </div>
      </div>
    </ViewportScrollShell>
  );
}
