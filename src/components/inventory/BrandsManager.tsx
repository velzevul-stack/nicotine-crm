'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ChevronUp, ChevronDown, GripVertical, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Brand {
  id: string;
  name: string;
  emojiPrefix: string;
  categoryId: string;
  sortOrder: number;
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  sortOrder: number;
}

export function BrandsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<Brand | null>(null);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ categories: Category[] }>('/api/inventory/categories'),
  });

  const { data: brandsData, isLoading, refetch: refetchBrands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => api<{ brands: Brand[] }>('/api/inventory/brands'),
  });

  const handleMoveUp = async (brand: Brand, index: number, categoryBrands: Brand[]) => {
    if (index === 0) return;
    const prevBrand = categoryBrands[index - 1];
    if (!prevBrand) return;
    
    // Создаем новый массив с измененным порядком
    const newOrder = [...categoryBrands];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    
    const categoryId = brand.categoryId;
    const brandIds = newOrder.map(b => b.id);
    
    try {
      await api('/api/inventory/brands/reorder-category', {
        method: 'POST',
        body: {
          categoryId,
          brandIds,
        },
      });
      
      await Promise.all([
        refetchBrands(),
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ]);
      
      toast({
        title: 'Порядок изменен',
        description: 'Бренд перемещен вверх',
      });
    } catch (error: any) {
      console.error('Error moving brand up:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось изменить порядок',
        variant: 'destructive',
      });
    }
  };

  const handleMoveDown = async (brand: Brand, index: number, categoryBrands: Brand[]) => {
    if (index >= categoryBrands.length - 1) return;
    const nextBrand = categoryBrands[index + 1];
    if (!nextBrand) return;
    
    // Создаем новый массив с измененным порядком
    const newOrder = [...categoryBrands];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    
    const categoryId = brand.categoryId;
    const brandIds = newOrder.map(b => b.id);
    
    try {
      await api('/api/inventory/brands/reorder-category', {
        method: 'POST',
        body: {
          categoryId,
          brandIds,
        },
      });
      
      await Promise.all([
        refetchBrands(),
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ]);
      
      toast({
        title: 'Порядок изменен',
        description: 'Бренд перемещен вниз',
      });
    } catch (error: any) {
      console.error('Error moving brand down:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось изменить порядок',
        variant: 'destructive',
      });
    }
  };

  const deleteBrandMutation = useMutation({
    mutationFn: async (brandId: string) => {
      await api(`/api/inventory/brand/${brandId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: 'Бренд удален',
        description: 'Бренд успешно удален',
      });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка удаления',
        description: error.message || 'Не удалось удалить бренд',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (brand: Brand) => {
    setDeleteConfirm(brand);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteBrandMutation.mutate(deleteConfirm.id);
    }
  };

  const categories = categoriesData?.categories || [];
  const brands = brandsData?.brands || [];

  // Группируем бренды по категориям
  const brandsByCategory = useMemo(() => {
    const grouped: Record<string, Brand[]> = {};
    categories.forEach((cat) => {
      const categoryBrands = brands
        .filter((b) => b.categoryId === cat.id)
        .sort((a, b) => {
          // Сначала по sortOrder, потом по name для стабильности
          if (a.sortOrder !== b.sortOrder) {
            return (a.sortOrder || 0) - (b.sortOrder || 0);
          }
          return a.name.localeCompare(b.name);
        });
      
      grouped[cat.id] = categoryBrands;
    });
    return grouped;
  }, [categories, brands]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Порядок брендов</h2>
        <p className="text-sm text-muted-foreground">
          Изменяйте порядок брендов внутри каждой категории
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <p>Нет категорий</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => {
            const categoryBrands = brandsByCategory[category.id] || [];
            if (categoryBrands.length === 0) return null;

            return (
              <div key={category.id} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-lg">{category.emoji}</span>
                  <h3 className="font-medium">{category.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    ({categoryBrands.length} бренд{categoryBrands.length !== 1 ? 'ов' : ''})
                  </span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {categoryBrands.map((brand, index) => {
                      const isFirst = index === 0;
                      const isLast = index === categoryBrands.length - 1;
                      
                      return (
                        <motion.div
                          key={brand.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
                        >
                          <GripVertical className="text-muted-foreground" size={16} />
                          <span className="text-lg">{brand.emojiPrefix}</span>
                          <div className="flex-1">
                            <p className="font-medium">{brand.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Порядок: {brand.sortOrder}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleMoveUp(brand, index, categoryBrands);
                              }}
                              disabled={isFirst}
                              className="h-8 w-8"
                              title="Переместить вверх"
                            >
                              <ChevronUp size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleMoveDown(brand, index, categoryBrands);
                              }}
                              disabled={isLast}
                              className="h-8 w-8"
                              title="Переместить вниз"
                            >
                              <ChevronDown size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(brand);
                              }}
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Удалить бренд"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить бренд?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить бренд "{deleteConfirm?.emojiPrefix} {deleteConfirm?.name}"?
              <br />
              <br />
              Это действие нельзя отменить. Если в бренде есть форматы продуктов, удаление будет невозможно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={deleteBrandMutation.isPending}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteBrandMutation.isPending}
            >
              {deleteBrandMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
