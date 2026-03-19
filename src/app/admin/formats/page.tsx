'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PostFormat {
  id: string;
  name: string;
  template: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminFormatsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFormat, setEditingFormat] = useState<PostFormat | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    template: '',
    isActive: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-formats'],
    queryFn: () => api<{ formats: PostFormat[] }>('/api/admin/formats'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; template: string; isActive: boolean }) =>
      api('/api/admin/formats', {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-formats'] });
      queryClient.invalidateQueries({ queryKey: ['post-formats'] });
      toast({ title: 'Формат создан' });
      setShowCreateModal(false);
      setFormData({ name: '', template: '', isActive: true });
    },
    onError: () => {
      toast({ title: 'Ошибка', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: string; name?: string; template?: string; isActive?: boolean }) =>
      api('/api/admin/formats', {
        method: 'PATCH',
        body: { id, updates },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-formats'] });
      queryClient.invalidateQueries({ queryKey: ['post-formats'] });
      toast({ title: 'Формат обновлен' });
      setEditingFormat(null);
      setFormData({ name: '', template: '', isActive: true });
    },
    onError: () => {
      toast({ title: 'Ошибка', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/formats?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-formats'] });
      queryClient.invalidateQueries({ queryKey: ['post-formats'] });
      toast({ title: 'Формат удален' });
    },
    onError: () => {
      toast({ title: 'Ошибка', variant: 'destructive' });
    },
  });

  const handleEdit = (format: PostFormat) => {
    setEditingFormat(format);
    setFormData({
      name: format.name,
      template: format.template,
      isActive: format.isActive,
    });
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.template.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Заполните все поля',
        variant: 'destructive',
      });
      return;
    }

    if (editingFormat) {
      updateMutation.mutate({
        id: editingFormat.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Форматы постов</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={16} className="mr-2" />
          Создать формат
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Загрузка...</div>
      ) : (
        <div className="space-y-4">
          {data?.formats.map((format) => (
            <Card key={format.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle>{format.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {format.isActive ? (
                        <span className="text-xs px-2 py-1 rounded bg-success/10 text-success">
                          Активен
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                          Неактивен
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(format)}
                    >
                      <Edit size={14} className="mr-1.5" />
                      Редактировать
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm('Удалить формат?')) {
                          deleteMutation.mutate(format.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Шаблон:</Label>
                  <pre className="text-xs bg-secondary p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {format.template}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    Доступные переменные: {'{content}'} - содержимое поста
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          {data?.formats.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Форматы не найдены. Создайте первый формат.
            </div>
          )}
        </div>
      )}

      <Dialog open={showCreateModal || !!editingFormat} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setEditingFormat(null);
          setFormData({ name: '', template: '', isActive: true });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFormat ? 'Редактировать формат' : 'Создать формат'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Название формата</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Стандартный"
              />
            </div>
            <div className="space-y-2">
              <Label>Шаблон</Label>
              <Textarea
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                placeholder="📦⚡️Доставка от 5 до 20 минут⚡️📦&#10;❗️ТОЛЬКО НАЛИЧКА❗️&#10;&#10;{content}"
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Используйте {'{content}'} для вставки содержимого поста
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Активен</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setEditingFormat(null);
                setFormData({ name: '', template: '', isActive: true });
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingFormat ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
