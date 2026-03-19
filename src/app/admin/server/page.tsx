'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Server, Database, Clock, Users, AlertTriangle, Power } from 'lucide-react';

interface ServerInfo {
  version: string;
  uptime: string;
  uptimeSeconds: number;
  dbConnected: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  activeUsersLastHour: number;
  nodeEnv: string;
}

export default function ServerManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [showShutdownDialog, setShowShutdownDialog] = useState(false);

  // Загружаем информацию о сервере
  const { data: serverInfo, isLoading } = useQuery<ServerInfo>({
    queryKey: ['server-info'],
    queryFn: () => api<ServerInfo>('/api/admin/server/info'),
    refetchInterval: 30000, // Обновляем каждые 30 секунд
  });

  // Загружаем статус режима обслуживания
  const { data: maintenanceStatus } = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: () =>
      api<{ enabled: boolean; message: string | null }>('/api/admin/maintenance'),
  });

  useEffect(() => {
    if (maintenanceStatus) {
      setMaintenanceEnabled(maintenanceStatus.enabled);
      setMaintenanceMessage(maintenanceStatus.message || '');
    }
  }, [maintenanceStatus]);

  // Мутация для изменения режима обслуживания
  const maintenanceMutation = useMutation({
    mutationFn: (data: { enabled: boolean; message?: string }) =>
      api('/api/admin/maintenance', {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-status'] });
      queryClient.invalidateQueries({ queryKey: ['server-info'] });
      toast({
        title: 'Успешно',
        description: maintenanceEnabled
          ? 'Режим обслуживания включен'
          : 'Режим обслуживания выключен',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось изменить режим обслуживания',
        variant: 'destructive',
      });
    },
  });

  const handleMaintenanceToggle = (enabled: boolean) => {
    setMaintenanceEnabled(enabled);
    maintenanceMutation.mutate({
      enabled,
      message: enabled ? maintenanceMessage : undefined,
    });
  };

  const handleUpdateMessage = () => {
    maintenanceMutation.mutate({
      enabled: maintenanceEnabled,
      message: maintenanceMessage,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <PageHeader title="Управление сервером" subtitle="Загрузка..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <PageHeader title="Управление сервером" subtitle="Мониторинг и управление системой" />

      {/* Информация о сервере */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server size={20} />
              Версия приложения
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{serverInfo?.version || 'unknown'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Окружение: {serverInfo?.nodeEnv || 'unknown'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={20} />
              Время работы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{serverInfo?.uptime || '—'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {serverInfo?.uptimeSeconds || 0} секунд
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database size={20} />
              База данных
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  serverInfo?.dbConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <p className="text-lg font-semibold">
                {serverInfo?.dbConnected ? 'Подключена' : 'Отключена'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} />
              Активные пользователи
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {serverInfo?.activeUsersLastHour || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-1">За последний час</p>
          </CardContent>
        </Card>
      </div>

      {/* Режим обслуживания */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle size={20} />
            Режим обслуживания
          </CardTitle>
          <CardDescription>
            Включите режим обслуживания перед обновлением системы. В этом режиме обычные
            пользователи не смогут использовать приложение.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenance-mode">Режим обслуживания</Label>
              <p className="text-sm text-muted-foreground">
                {maintenanceEnabled
                  ? 'Система находится на обслуживании'
                  : 'Система работает в обычном режиме'}
              </p>
            </div>
            <Switch
              id="maintenance-mode"
              checked={maintenanceEnabled}
              onCheckedChange={handleMaintenanceToggle}
              disabled={maintenanceMutation.isPending}
            />
          </div>

          {maintenanceEnabled && (
            <div className="space-y-2">
              <Label htmlFor="maintenance-message">Сообщение для пользователей</Label>
              <Textarea
                id="maintenance-message"
                placeholder="Система находится на техническом обслуживании. Пожалуйста, попробуйте позже."
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                rows={3}
              />
              <Button onClick={handleUpdateMessage} disabled={maintenanceMutation.isPending}>
                Обновить сообщение
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Опасные действия */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Power size={20} />
            Опасные действия
          </CardTitle>
          <CardDescription>
            Эти действия могут повлиять на работу системы. Используйте с осторожностью.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowShutdownDialog(true)}
            className="w-full"
          >
            <Power size={16} className="mr-2" />
            Graceful Shutdown (в разработке)
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Эта функция будет доступна в будущих версиях
          </p>
        </CardContent>
      </Card>

      {/* Диалог подтверждения shutdown */}
      <Dialog open={showShutdownDialog} onOpenChange={setShowShutdownDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите выполнить graceful shutdown? Это остановит сервер после
              завершения текущих запросов.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShutdownDialog(false)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled>
              Подтвердить (в разработке)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
