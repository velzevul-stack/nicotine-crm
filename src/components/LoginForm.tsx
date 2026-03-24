'use client';

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getTelegramWebApp, waitForTelegramInitData } from '@/lib/telegram-mini-app';
import {
  takeAccessKeyFromUrlForLogin,
  clearAccessKeyFromUrlSession,
  tryMarkNavKeyAutoLoginAttempt,
  resetNavKeyAutoLoginAttempt,
} from '@/lib/access-key-from-url';
import { ViewportScrollShell, viewportMainCentered } from '@/components/ViewportScrollShell';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'telegram_access_key';

export function LoginForm() {
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
    if (pathname !== '/') {
      clearAccessKeyFromUrlSession();
    }
  }, [pathname]);

  const handleLoginSuccess = useCallback((subscriptionStatus?: { canAccess: boolean; hasActiveSubscription: boolean; isTrialExpired: boolean }) => {
    // Сначала логин выполнен, теперь проверяем подписку
    if (subscriptionStatus && !subscriptionStatus.canAccess) {
      // Подписка истекла - редиректим на страницу истечения подписки
      router.replace('/subscription-expired');
    } else {
      // Подписка активна - редиректим в приложение (dashboard)
      router.replace('/dashboard');
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
      resetNavKeyAutoLoginAttempt();
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
      resetNavKeyAutoLoginAttempt();
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

      if (res.ok) {
        const data = await res.json();
        clearAccessKeyFromUrlSession();
        // Сохраняем ключ в localStorage для Telegram mini-app
        if (isTelegramApp) {
          localStorage.setItem(STORAGE_KEY, accessKey);
        }
        // Проверяем подписку и редиректим соответственно
        handleLoginSuccess(data.subscriptionStatus);
      } else {
        const data = await res.json();
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
    <ViewportScrollShell maxWidth="md" mainClassName={cn(viewportMainCentered, 'p-6')}>
      <div className="w-full max-w-md">
        <div className="bg-card rounded-[24px] p-8 border border-border">
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-primary/20 rounded-[20px] mb-4">
              <KeyRound size={40} className="text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="text-foreground text-xl font-semibold mb-2">Вход в систему</h1>
            <p className="text-muted-foreground text-sm text-center">
              {isTelegramApp
                ? 'Авторизация через Telegram происходит автоматически. Ключ доступа будет сохранен для следующих входов.'
                : 'Введите ключ доступа для входа в приложение'}
            </p>
          </div>

          <form onSubmit={handleKeyLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-2">
                Ключ доступа
              </label>
              <input
                type="text"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="KEY-XXXXX или ваш ключ"
                disabled={loading}
                className="w-full bg-muted rounded-[14px] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                style={{ fontSize: '0.9375rem' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !accessKey.trim()}
              className="w-full rounded-[18px] px-8 py-4 bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <KeyRound size={20} strokeWidth={1.5} />
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </ViewportScrollShell>
  );
}
