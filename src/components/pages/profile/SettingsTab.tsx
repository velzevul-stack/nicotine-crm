'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useHintSeen } from '@/hooks/use-hint-seen';
import { Moon, Sun, Settings, MessageCircle } from 'lucide-react';

export function SettingsTab() {
  const { toast } = useToast();
  const [showHint] = useHintSeen('settings');

  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () =>
      api<{ name: string; address: string | null; currency: string; timezone: string; supportTelegramUsername: string | null }>(
        '/api/shop'
      ),
  });

  const updateShopMutation = useMutation({
    mutationFn: (payload: { name?: string; address?: string | null; currency?: string }) =>
      api('/api/shop', { method: 'PATCH', body: payload }),
    onSuccess: () => {
      toast({ title: 'Настройки сохранены', description: 'Изменения применены' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    },
  });

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('BYN');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (shopData) {
      setName(shopData.name || '');
      setAddress(shopData.address || '');
      setCurrency(shopData.currency || 'BYN');
    }
  }, [shopData]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleSave = () => {
    updateShopMutation.mutate({
      name,
      address: address.trim() || null,
      currency,
    });
  };

  return (
    <div className="space-y-3">
      {showHint && (
        <div className="bg-[#1B2030] rounded-[16px] p-4">
          <p className="text-xs text-[#9CA3AF] mb-2">
            <strong>Подсказка:</strong> Здесь можно изменить название магазина, адрес, валюту и тему оформления.
          </p>
        </div>
      )}

      <div className="bg-[#BFE7E5] rounded-[20px] p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[14px] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(191, 231, 229, 0.5)' }}
          >
            <Settings size={18} className="text-[#111111]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs text-[#1A1A1A] opacity-70">Настройки магазина</p>
            <p className="font-semibold text-lg text-[#111111]">
              {shopData?.name || 'Магазин'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-1 block">
            Тема
          </label>
          <button
            onClick={toggleTheme}
            className="w-full py-3 px-4 rounded-[12px] bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm flex items-center justify-between hover:bg-[#1B2030]/80 transition-colors"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
              <span>{theme === 'dark' ? 'Тёмная' : 'Светлая'}</span>
            </span>
          </button>
        </div>

        <div>
          <label className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-1 block">
            Валюта
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full py-3 px-4 rounded-[12px] bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm focus:outline-none focus:ring-2 focus:ring-[#BFE7E5]/30"
          >
            <option value="BYN">BYN - Белорусский рубль</option>
            <option value="USD">$ - Доллар США</option>
            <option value="RUB">₽ - Российский рубль</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-1 block">
            Название магазина
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите название"
            className="w-full py-3 px-4 rounded-[12px] bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#BFE7E5]/30"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-1 block">
            Адрес
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Введите адрес магазина"
            className="w-full py-3 px-4 rounded-[12px] bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#BFE7E5]/30"
          />
        </div>

        {shopData?.supportTelegramUsername && (
          <a
            href={`https://t.me/${shopData.supportTelegramUsername.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-[12px] bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm flex items-center gap-2 hover:bg-[#1B2030]/80 transition-colors"
          >
            <MessageCircle size={18} className="text-[#BFE7E5]" />
            <span>Поддержка</span>
          </a>
        )}

        <button
          onClick={handleSave}
          disabled={updateShopMutation.isPending}
          className="w-full h-11 rounded-[14px] bg-[#BFE7E5] text-[#111111] font-semibold disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          {updateShopMutation.isPending ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
