'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface Card {
  id: string;
  name: string;
  sortOrder: number;
}

export function CardsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const { data: cards = [] } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api<Card[]>('/api/cards'),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api<Card>('/api/cards', { method: 'POST', body: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      setNewName('');
      toast({ title: 'Карта добавлена', description: 'Карта успешно создана' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось добавить карту',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api(`/api/cards/${id}`, { method: 'PATCH', body: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      setEditingId(null);
      setEditingName('');
      toast({ title: 'Карта обновлена', description: 'Изменения сохранены' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось обновить карту',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/cards/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast({ title: 'Карта удалена', description: 'Карта успешно удалена' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось удалить карту',
        variant: 'destructive',
      });
    },
  });

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(name);
  };

  const handleStartEdit = (card: Card) => {
    setEditingId(card.id);
    setEditingName(card.name);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editingName.trim()) return;
    updateMutation.mutate({ id: editingId, name: editingName.trim() });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Название карты"
          className="flex-1 h-10 px-4 rounded-xl bg-[#1B2030] border border-white/10 text-[#F5F5F7] text-sm placeholder:text-[#6B7280]"
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={!newName.trim() || createMutation.isPending}
          className="h-10 px-4 rounded-xl bg-[#BFE7E5]/30 text-[#BFE7E5] text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Plus size={18} />
          Добавить
        </motion.button>
      </div>

      <div className="space-y-2">
        {cards.map((card) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-[14px] bg-[#1B2030] border border-white/5"
          >
            {editingId === card.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="flex-1 h-9 px-3 rounded-lg bg-[#151922] border border-white/10 text-[#F5F5F7] text-sm"
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  disabled={!editingName.trim() || updateMutation.isPending}
                  className="h-9 px-3 rounded-lg bg-[#BFE7E5]/30 text-[#BFE7E5] text-xs font-medium disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="h-9 px-3 rounded-lg bg-white/10 text-[#9CA3AF] text-xs"
                >
                  Отмена
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-[#F5F5F7]">
                  {card.name}
                </span>
                <button
                  onClick={() => handleStartEdit(card)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-white/10 hover:text-[#BFE7E5] transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(card.id)}
                  disabled={deleteMutation.isPending}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-destructive/20 hover:text-destructive transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {cards.length === 0 && (
        <p className="text-sm text-[#9CA3AF] text-center py-6">
          Нет карт. Добавьте карту для учёта оплат по картам в отчётах.
        </p>
      )}
    </div>
  );
}
