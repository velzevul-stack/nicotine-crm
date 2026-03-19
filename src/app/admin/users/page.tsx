'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Ban, CheckCircle, Calendar as CalendarIcon, Users, Gift, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ReferrerInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  referralCode: string | null;
}

interface User {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: 'admin' | 'seller' | 'client';
  subscriptionStatus: 'trial' | 'active' | 'expired';
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  isActive: boolean;
  createdAt: string;
  referralCode: string | null;
  referrerId: string | null;
  referralsCount?: number;
  activeReferralsCount?: number;
  referrerInfo?: ReferrerInfo | null;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingTrialDate, setEditingTrialDate] = useState<string | null>(null);
  const [editingSubscriptionDate, setEditingSubscriptionDate] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => api<{ users: User[] }>(`/api/admin/users?search=${encodeURIComponent(search)}`),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: any }) =>
      api('/api/admin/users', {
        method: 'PATCH',
        body: { userId, updates },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Пользователь обновлен' });
    },
    onError: () => {
      toast({ title: 'Ошибка', variant: 'destructive' });
    },
  });

  const handleUpdateRole = (userId: string, role: string) => {
    updateUserMutation.mutate({ userId, updates: { role } });
  };

  const handleUpdateSubscription = (userId: string, status: string) => {
    updateUserMutation.mutate({ userId, updates: { subscriptionStatus: status } });
  };

  const handleToggleActive = (user: User) => {
    updateUserMutation.mutate({ userId: user.id, updates: { isActive: !user.isActive } });
  };

  const handleUpdateTrialDate = (userId: string, date: Date | undefined) => {
    if (!date) {
      updateUserMutation.mutate({ userId, updates: { trialEndsAt: null } });
      setEditingTrialDate(null);
      return;
    }
    updateUserMutation.mutate({
      userId,
      updates: { trialEndsAt: date.toISOString() },
    });
    setEditingTrialDate(null);
  };

  const handleUpdateSubscriptionDate = (userId: string, date: Date | undefined) => {
    if (!date) {
      updateUserMutation.mutate({ userId, updates: { subscriptionEndsAt: null } });
      setEditingSubscriptionDate(null);
      return;
    }
    updateUserMutation.mutate({
      userId,
      updates: { subscriptionEndsAt: date.toISOString() },
    });
    setEditingSubscriptionDate(null);
  };

  const getStatusBadge = (user: User) => {
    if (!user.isActive) {
      return <span className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive">Забанен</span>;
    }
    if (user.subscriptionStatus === 'active') {
      return <span className="text-xs px-2 py-1 rounded bg-success/10 text-success">Активна</span>;
    }
    if (user.subscriptionStatus === 'trial') {
      return <span className="text-xs px-2 py-1 rounded bg-warning/10 text-warning">Триал</span>;
    }
    return <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">Истекла</span>;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Управление пользователями</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Поиск</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по username, имени или Telegram ID..."
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">Загрузка...</div>
      ) : (
        <div className="space-y-4">
          {data?.users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">
                        {user.firstName} {user.lastName || ''} (@{user.username || 'нет username'})
                      </h3>
                      {getStatusBadge(user)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>Telegram ID: {user.telegramId}</p>
                      <p>Роль: {user.role === 'seller' ? 'Продавец' : user.role === 'client' ? 'Клиент' : 'Админ'}</p>
                      {user.referralCode && (
                        <p className="flex items-center gap-2">
                          <span>Реферальный код:</span>
                          <code className="px-2 py-1 bg-secondary rounded text-xs font-mono">{user.referralCode}</code>
                        </p>
                      )}
                      {user.referrerInfo && (
                        <p className="flex items-center gap-2">
                          <span>Приглашен:</span>
                          <span className="text-primary">
                            {user.referrerInfo.firstName || ''} {user.referrerInfo.lastName || ''}
                            {user.referrerInfo.username && ` (@${user.referrerInfo.username})`}
                          </span>
                        </p>
                      )}
                      {typeof user.referralsCount === 'number' && (
                        <div className="pt-2 mt-2 border-t border-border">
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Users size={16} className="text-muted-foreground" />
                              <span className="text-xs">Рефералов: <strong className="text-foreground">{user.referralsCount}</strong></span>
                            </div>
                            {user.activeReferralsCount !== undefined && (
                              <div className="flex items-center gap-2">
                                <Star size={16} className="text-green-400" />
                                <span className="text-xs">С подпиской: <strong className="text-green-400">{user.activeReferralsCount}</strong></span>
                              </div>
                            )}
                            {user.activeReferralsCount !== undefined && user.activeReferralsCount > 0 && (
                              <div className="flex items-center gap-2 px-2 py-1 rounded bg-primary/10">
                                <Gift size={16} className="text-primary" />
                                <span className="text-xs font-semibold text-primary">
                                  Бесплатных месяцев: <strong>{user.activeReferralsCount}</strong>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span>Триал до:</span>
                        <Popover
                          open={editingTrialDate === user.id}
                          onOpenChange={(open) => setEditingTrialDate(open ? user.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'w-[180px] justify-start text-left font-normal',
                                !user.trialEndsAt && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {user.trialEndsAt ? (
                                format(new Date(user.trialEndsAt), 'dd.MM.yyyy', { locale: ru })
                              ) : (
                                <span>Не установлена</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={user.trialEndsAt ? new Date(user.trialEndsAt) : undefined}
                              onSelect={(date) => handleUpdateTrialDate(user.id, date)}
                              initialFocus
                            />
                            <div className="p-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => handleUpdateTrialDate(user.id, undefined)}
                              >
                                Очистить
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Подписка до:</span>
                        <Popover
                          open={editingSubscriptionDate === user.id}
                          onOpenChange={(open) => setEditingSubscriptionDate(open ? user.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'w-[180px] justify-start text-left font-normal',
                                !user.subscriptionEndsAt && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {user.subscriptionEndsAt ? (
                                format(new Date(user.subscriptionEndsAt), 'dd.MM.yyyy', { locale: ru })
                              ) : (
                                <span>Не установлена</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : undefined}
                              onSelect={(date) => handleUpdateSubscriptionDate(user.id, date)}
                              initialFocus
                            />
                            <div className="p-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => handleUpdateSubscriptionDate(user.id, undefined)}
                              >
                                Очистить
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleUpdateRole(user.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seller">Продавец</SelectItem>
                        <SelectItem value="client">Клиент</SelectItem>
                        <SelectItem value="admin">Админ</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={user.subscriptionStatus}
                      onValueChange={(value) => handleUpdateSubscription(user.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Триал</SelectItem>
                        <SelectItem value="active">Активна</SelectItem>
                        <SelectItem value="expired">Истекла</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant={user.isActive ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.isActive ? (
                        <>
                          <Ban className="w-4 h-4 mr-2" />
                          Забанить
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Разбанить
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {data?.users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">Пользователи не найдены</div>
          )}
        </div>
      )}
    </div>
  );
}
