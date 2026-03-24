'use client';

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getTelegramWebApp, waitForTelegramInitData } from '@/lib/telegram-mini-app';
import {
  takeAccessKeyFromUrlForLogin,
  clearAccessKeyFromUrlSession,
  tryMarkNavKeyAutoLoginAttempt,
  resetNavKeyAutoLoginAttempt,
} from '@/lib/access-key-from-url';
import { ViewportScrollShell, viewportMainCentered } from '@/components/ViewportScrollShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'telegram_access_key';

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTelegramApp, setIsTelegramApp] = useState(false);
  const keyFromBotUrlRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const k = takeAccessKeyFromUrlForLogin();
    keyFromBotUrlRef.current = k;
    if (k) setAccessKey(k);
  }, []);

  useEffect(() => {
    if (pathname !== '/login') {
      clearAccessKeyFromUrlSession();
    }
  }, [pathname]);

  const handleLoginSuccess = useCallback((subscriptionStatus?: { canAccess: boolean; hasActiveSubscription: boolean; isTrialExpired: boolean }) => {
    // Сначала логин выполнен, теперь проверяем подписку
    if (subscriptionStatus && !subscriptionStatus.canAccess) {
      // Подписка истекла - редиректим на страницу истечения подписки
      router.replace('/subscription-expired');
    } else {
      // Подписка активна - открываем приложение (редирект на главную, которая проверит и перенаправит)
      router.replace('/');
    }
  }, [router]);

  const performLogin = useCallback(async (key: string, isTgApp: boolean) => {
    const res = await fetch('/api/auth/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey: key }),
    });

    if (res.ok) {
      const data = await res.json();
      clearAccessKeyFromUrlSession();
      // Сохраняем ключ в localStorage для Telegram mini-app
      if (isTgApp) {
        localStorage.setItem(STORAGE_KEY, key);
      }
      handleLoginSuccess(data.subscriptionStatus);
    } else {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Login failed');
    }
  }, [handleLoginSuccess]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (typeof window === 'undefined') return;

      const tgEarly = getTelegramWebApp();
      if (tgEarly) {
        setIsTelegramApp(true);
        setLoading(true);
      }

      const initData = await waitForTelegramInitData();

      if (cancelled) return;

      const tg = getTelegramWebApp();
      if (tg) setIsTelegramApp(true);

      if (!tg) {
        setLoading(false);
        const savedKey = localStorage.getItem(STORAGE_KEY);
        if (savedKey) setAccessKey(savedKey);
        return;
      }

      const navKey = keyFromBotUrlRef.current;
      if (navKey?.trim() && tryMarkNavKeyAutoLoginAttempt(navKey.trim())) {
        setLoading(true);
        try {
          await performLogin(navKey.trim(), true);
          return;
        } catch (e) {
          console.error(e);
          resetNavKeyAutoLoginAttempt();
          setAccessKey(navKey.trim());
          toast({
            title: 'Ошибка входа',
            description: e instanceof Error ? e.message : 'Проверьте ключ и попробуйте снова.',
            variant: 'destructive',
          });
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      if (initData) {
        try {
          const savedKey = localStorage.getItem(STORAGE_KEY);

          if (savedKey) {
            await performLogin(savedKey, true);
            return;
          }

          const res = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          });

          if (res.ok) {
            const data = await res.json();
            const key = data.user?.accessKey as string | undefined;
            if (key) {
              localStorage.setItem(STORAGE_KEY, key);
              setAccessKey(key);
            }
            handleLoginSuccess(data.subscriptionStatus);
            return;
          }

          const errJson = await res.json().catch(() => ({}));
          toast({
            title: 'Ошибка входа через Telegram',
            description: (errJson as { message?: string }).message || 'Не удалось авторизоваться автоматически.',
            variant: 'destructive',
          });
        } catch (e) {
          console.error(e);
          toast({
            title: 'Ошибка',
            description: 'Произошла ошибка при попытке входа',
            variant: 'destructive',
          });
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      setLoading(false);
      const savedKey = localStorage.getItem(STORAGE_KEY);
      if (savedKey) {
        setLoading(true);
        try {
          await performLogin(savedKey, true);
        } catch (e) {
          console.error(e);
          setAccessKey(savedKey);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [toast, performLogin, handleLoginSuccess]);


  const handleKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey }),
      });

      const data = await res.json();

      if (res.ok) {
        clearAccessKeyFromUrlSession();
        // Сохраняем ключ в localStorage для Telegram mini-app
        if (isTelegramApp) {
          localStorage.setItem(STORAGE_KEY, accessKey);
        }
        // Проверяем подписку и редиректим соответственно
        handleLoginSuccess(data.subscriptionStatus);
      } else {
        console.error('Login failed:', data);
        toast({
          title: "Ошибка входа",
          description: data.message || "Неверный ключ доступа",
          variant: "destructive"
        });
      }
    } catch (e) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при попытке входа",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ViewportScrollShell maxWidth="md" mainClassName={viewportMainCentered}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Вход в систему</CardTitle>
          <CardDescription>
            {isTelegramApp 
              ? "Авторизация через Telegram происходит автоматически. Ключ доступа будет сохранен для следующих входов."
              : "Введите ключ доступа для входа в систему"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleKeyLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Введите ключ доступа (Access Key)"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !accessKey.trim()}>
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </ViewportScrollShell>
  );
}
