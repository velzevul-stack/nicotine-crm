'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'telegram_access_key';

export default function LoginPage() {
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

      const data = await res.json();

      if (res.ok) {
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
    </div>
  );
}
