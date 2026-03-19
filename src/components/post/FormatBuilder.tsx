'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FormatEditor } from './FormatEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PostFormat {
  id: string;
  name: string;
  template: string;
  config: any;
  shopId: string | null;
  isActive: boolean;
  createdAt: string;
}

export function FormatBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingFormat, setEditingFormat] = useState<PostFormat | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: formatsData, isLoading } = useQuery({
    queryKey: ['post-formats'],
    queryFn: () =>
      api<{ formats: PostFormat[] }>('/api/post/formats'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/post/formats/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-formats'] });
      toast({
        title: 'Формат удален',
        description: 'Формат успешно удален.',
      });
    },
    onError: () => {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить формат',
        variant: 'destructive',
      });
    },
  });

  const formats = formatsData?.formats || [];
  const globalFormats = formats.filter((f) => f.shopId === null);
  const shopFormats = formats.filter((f) => f.shopId !== null);

  const handleDelete = (format: PostFormat) => {
    if (format.shopId === null) {
      toast({
        title: 'Ошибка',
        description: 'Нельзя удалять глобальные форматы',
        variant: 'destructive',
      });
      return;
    }

    if (confirm(`Удалить формат "${format.name}"?`)) {
      deleteMutation.mutate(format.id);
    }
  };

  const handleEdit = (format: PostFormat) => {
    if (format.shopId === null) {
      toast({
        title: 'Ошибка',
        description: 'Нельзя редактировать глобальные форматы',
        variant: 'destructive',
      });
      return;
    }
    setEditingFormat(format);
  };

  return (
    <>
      <ScreenHeader
        title="Форматы постов"
        subtitle="Создавайте и управляйте форматами постов"
      />

      <div className="px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ваши форматы</h2>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus size={16} className="mr-2" />
            Создать формат
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Загрузка...
          </div>
        ) : (
          <>
            {shopFormats.length > 0 && (
              <div className="space-y-2">
                {shopFormats.map((format) => (
                  <div
                    key={format.id}
                    className="glass-card rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">{format.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format.isActive ? '✅ Активен' : '❌ Неактивен'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(format)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(format)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {globalFormats.length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-lg font-semibold">Глобальные форматы</h2>
                <div className="space-y-2">
                  {globalFormats.map((format) => (
                    <div
                      key={format.id}
                      className="glass-card rounded-xl p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium">
                          {format.name} 🌐
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format.isActive ? '✅ Активен' : '❌ Неактивен'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Import global format
                          api('/api/post/formats/import', {
                            method: 'POST',
                            body: { formatId: format.id },
                          }).then(() => {
                            queryClient.invalidateQueries({
                              queryKey: ['post-formats'],
                            });
                            toast({
                              title: 'Формат импортирован',
                              description: 'Глобальный формат скопирован в ваши форматы',
                            });
                          });
                        }}
                      >
                        <Download size={14} className="mr-2" />
                        Импортировать
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Нет форматов. Создайте первый формат!
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создать новый формат</DialogTitle>
          </DialogHeader>
          <FormatEditor
            onSave={() => {
              setShowCreateDialog(false);
              queryClient.invalidateQueries({ queryKey: ['post-formats'] });
            }}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {editingFormat && (
        <Dialog open={!!editingFormat} onOpenChange={() => setEditingFormat(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактировать формат</DialogTitle>
            </DialogHeader>
            <FormatEditor
              format={editingFormat}
              onSave={() => {
                setEditingFormat(null);
                queryClient.invalidateQueries({ queryKey: ['post-formats'] });
              }}
              onCancel={() => setEditingFormat(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
