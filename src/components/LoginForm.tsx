'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'telegram_access_key';

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTelegramApp, setIsTelegramApp] = useState(false);

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
    const init = async () => {
      // Check for Telegram initData
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        setIsTelegramApp(true);
        const tg = (window as any).Telegram.WebApp;
        const initData = tg.initData;

        if (initData) {
          setLoading(true);
          try {
            // Проверяем, есть ли сохраненный ключ в localStorage
            const savedKey = localStorage.getItem(STORAGE_KEY);
            
            if (savedKey) {
              // Если ключ есть, автоматически входим по нему (для бота)
              await performLogin(savedKey, true);
              return;
            }

            // Если ключа нет, авторизуемся через Telegram (первый раз)
            const res = await fetch('/api/auth/telegram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData }),
            });
            
            if (res.ok) {
              const data = await res.json();
              
              // Сохраняем accessKey в localStorage для следующего раза
              if (data.user?.accessKey) {
                localStorage.setItem(STORAGE_KEY, data.user.accessKey);
              }
              
              // Проверяем подписку и редиректим соответственно
              handleLoginSuccess(data.subscriptionStatus);
              return;
            } else {
              toast({
                title: "Ошибка входа через Telegram",
                description: "Не удалось авторизоваться автоматически.",
                variant: "destructive"
              });
            }
          } catch (e) {
            console.error(e);
            toast({
              title: "Ошибка",
              description: "Произошла ошибка при попытке входа",
              variant: "destructive"
            });
          } finally {
            setLoading(false);
          }
        } else {
          // Если нет initData, но мы в Telegram, загружаем сохраненный ключ и автоматически входим
          const savedKey = localStorage.getItem(STORAGE_KEY);
          if (savedKey) {
            setLoading(true);
            try {
              await performLogin(savedKey, true);
            } catch (e) {
              console.error(e);
              setAccessKey(savedKey);
              setLoading(false);
            }
          }
        }
      } else {
        // Для браузера просто показываем форму логина
        // Можно загрузить сохраненный ключ для удобства, но не авторизовываться автоматически
        const savedKey = localStorage.getItem(STORAGE_KEY);
        if (savedKey) {
          setAccessKey(savedKey);
        }
      }
    };
    init();
  }, [router, toast, performLogin, handleLoginSuccess]);

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
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
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
    </div>
  );
}
