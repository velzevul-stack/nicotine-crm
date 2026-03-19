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
import { Check, X, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Suggestion {
  id: string;
  userId: string;
  text: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export default function AdminSuggestionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showCreateFormatModal, setShowCreateFormatModal] = useState(false);
  const [formatName, setFormatName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-suggestions'],
    queryFn: () => api<{ suggestions: Suggestion[] }>('/api/admin/suggestions'),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      createFormat,
      formatName,
    }: {
      id: string;
      status: 'pending' | 'approved' | 'rejected';
      createFormat?: boolean;
      formatName?: string;
    }) =>
      api('/api/admin/suggestions', {
        method: 'PATCH',
        body: { id, status, createFormat, formatName },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-formats'] });
      queryClient.invalidateQueries({ queryKey: ['post-formats'] });
      toast({ title: 'Предложение обновлено' });
      setShowCreateFormatModal(false);
      setSelectedSuggestion(null);
      setFormatName('');
    },
    onError: () => {
      toast({ title: 'Ошибка', variant: 'destructive' });
    },
  });

  const handleApprove = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
    setFormatName(`Формат от ${suggestion.user?.firstName || suggestion.user?.username || 'пользователя'}`);
    setShowCreateFormatModal(true);
  };

  const handleApproveWithFormat = () => {
    if (!selectedSuggestion || !formatName.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название формата',
        variant: 'destructive',
      });
      return;
    }
    updateMutation.mutate({
      id: selectedSuggestion.id,
      status: 'approved',
      createFormat: true,
      formatName: formatName.trim(),
    });
  };

  const handleReject = (id: string) => {
    if (confirm('Отклонить предложение?')) {
      updateMutation.mutate({ id, status: 'rejected' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="text-xs px-2 py-1 rounded bg-success/10 text-success">
            Одобрено
          </span>
        );
      case 'rejected':
        return (
          <span className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive">
            Отклонено
          </span>
        );
      default:
        return (
          <span className="text-xs px-2 py-1 rounded bg-warning/10 text-warning">
            На рассмотрении
          </span>
        );
    }
  };

  const pendingSuggestions = data?.suggestions.filter((s) => s.status === 'pending') || [];
  const otherSuggestions = data?.suggestions.filter((s) => s.status !== 'pending') || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Предложения форматов</h1>

      {isLoading ? (
        <div className="text-center py-8">Загрузка...</div>
      ) : (
        <div className="space-y-6">
          {pendingSuggestions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">На рассмотрении</h2>
              <div className="space-y-4">
                {pendingSuggestions.map((suggestion) => (
                  <Card key={suggestion.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-base">
                              {suggestion.user
                                ? `${suggestion.user.firstName || ''} ${suggestion.user.lastName || ''}`.trim() ||
                                  suggestion.user.username ||
                                  'Пользователь'
                                : 'Неизвестный пользователь'}
                            </CardTitle>
                            {getStatusBadge(suggestion.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(suggestion.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(suggestion)}
                          >
                            <Check size={14} className="mr-1.5" />
                            Одобрить
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReject(suggestion.id)}
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm whitespace-pre-wrap bg-secondary p-3 rounded-lg">
                        {suggestion.text}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {otherSuggestions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Остальные</h2>
              <div className="space-y-4">
                {otherSuggestions.map((suggestion) => (
                  <Card key={suggestion.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-base">
                              {suggestion.user
                                ? `${suggestion.user.firstName || ''} ${suggestion.user.lastName || ''}`.trim() ||
                                  suggestion.user.username ||
                                  'Пользователь'
                                : 'Неизвестный пользователь'}
                            </CardTitle>
                            {getStatusBadge(suggestion.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(suggestion.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm whitespace-pre-wrap bg-secondary p-3 rounded-lg">
                        {suggestion.text}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {data?.suggestions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Предложений пока нет
            </div>
          )}
        </div>
      )}

      <Dialog open={showCreateFormatModal} onOpenChange={setShowCreateFormatModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать формат на основе предложения</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Название формата</Label>
              <Input
                value={formatName}
                onChange={(e) => setFormatName(e.target.value)}
                placeholder="Введите название формата"
              />
            </div>
            {selectedSuggestion && (
              <div className="space-y-2">
                <Label>Текст предложения (будет использован как шаблон)</Label>
                <pre className="text-sm bg-secondary p-3 rounded-lg whitespace-pre-wrap">
                  {selectedSuggestion.text}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFormatModal(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleApproveWithFormat}
              disabled={updateMutation.isPending || !formatName.trim()}
            >
              Создать и одобрить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
