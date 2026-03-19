'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Trash2 } from 'lucide-react';

interface EditBrandModalProps {
  brand: any | null;
  format: any | null;
  categories: any[];
  brands: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Функция проверки похожести строк (Levenshtein distance)
function areSimilar(str1: string, str2: string): boolean {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Если строки идентичны (без учета регистра)
  if (s1 === s2) return true;
  
  // Если разница только в регистре нескольких символов
  if (str1.toLowerCase() === str2.toLowerCase()) return true;
  
  // Проверка расстояния Левенштейна (максимум 2 символа разницы)
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  
  if (maxLen === 0) return false;
  
  // Если разница в длине больше 2, не похожи
  if (Math.abs(len1 - len2) > 2) return false;
  
  // Простая проверка: если одна строка содержит другую и разница небольшая
  if (s1.includes(s2) || s2.includes(s1)) {
    const diff = Math.abs(len1 - len2);
    if (diff <= 2) return true;
  }
  
  // Подсчет различий посимвольно
  let differences = 0;
  const minLen = Math.min(len1, len2);
  for (let i = 0; i < minLen; i++) {
    if (s1[i] !== s2[i]) differences++;
  }
  differences += Math.abs(len1 - len2);
  
  return differences <= 2;
}

export function EditBrandModal({ brand, format, categories, brands, open, onOpenChange }: EditBrandModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    emojiPrefix: '',
    categoryId: '',
    strengthLabel: '',
    unitPrice: '' as number | string,
    isActive: true,
  });

  useEffect(() => {
    if (brand && format) {
      setFormData({
        name: brand.name || '',
        emojiPrefix: brand.emojiPrefix || '',
        categoryId: brand.categoryId || '',
        strengthLabel: format.strengthLabel || '',
        unitPrice: format.unitPrice || '',
        isActive: format.isActive ?? true,
      });
    }
  }, [brand, format]);

  // Проверка на похожие бренды
  const similarBrands = useMemo(() => {
    if (!formData.name || formData.name.length < 2) return [];
    if (!formData.categoryId) return [];
    
    return brands.filter((b: any) => {
      if (b.id === brand?.id) return false; // Исключаем текущий бренд при редактировании
      if (b.categoryId !== formData.categoryId) return false;
      return areSimilar(b.name, formData.name);
    });
  }, [formData.name, formData.categoryId, brands, brand]);

  const updateBrandMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Обновляем бренд
      await api(`/api/inventory/brand/${brand?.id}`, {
        method: 'PATCH',
        body: {
          name: data.name,
          emojiPrefix: data.emojiPrefix,
          categoryId: data.categoryId,
        },
      });
      
      // Обновляем формат
      await api(`/api/inventory/format/${format?.id}`, {
        method: 'PATCH',
        body: {
          name: data.name, // Формат имеет то же название что и бренд
          strengthLabel: data.strengthLabel,
          unitPrice: data.unitPrice,
          isActive: data.isActive,
          brandId: brand?.id,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({ title: 'Бренд обновлен' });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: 'Ошибка обновления',
        description: err.message || 'Не удалось обновить бренд',
        variant: 'destructive',
      });
      toast({ title: 'Ошибка обновления', variant: 'destructive' });
    },
  });

  const deleteBrandMutation = useMutation({
    mutationFn: async () => {
      if (!brand) return;
      await api(`/api/inventory/brand/${brand.id}`, {
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
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка удаления',
        description: error.message || 'Не удалось удалить бренд',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !format) return;
    
    if (similarBrands.length > 0) {
      toast({
        title: 'Похожий бренд уже существует',
        description: `Найдены похожие бренды: ${similarBrands.map((b: any) => b.name).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    
    const unitPriceValue = typeof formData.unitPrice === 'string' 
      ? (formData.unitPrice === '' ? 0 : parseFloat(formData.unitPrice) || 0)
      : formData.unitPrice;
    
    if (unitPriceValue <= 0) {
      toast({
        title: 'Ошибка',
        description: 'Цена продажи должна быть больше нуля',
        variant: 'destructive',
      });
      return;
    }
    
    updateBrandMutation.mutate({
      ...formData,
      unitPrice: unitPriceValue,
    });
  };

  if (!brand || !format) return null;

  const selectedCategory = categories.find((c: any) => c.id === formData.categoryId);
  const isLiquidCategory = selectedCategory?.name?.toLowerCase().includes('жидкост') || 
                           selectedCategory?.name?.toLowerCase().includes('liquid');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактирование бренда (линейки)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название бренда (линейки)</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            {similarBrands.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 rounded-lg text-xs">
                <AlertCircle size={14} className="text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning mb-1">Похожий бренд уже существует:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {similarBrands.map((b: any) => (
                      <li key={b.id}>{b.emojiPrefix} {b.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="emojiPrefix">Эмодзи префикс</Label>
            <Input
              id="emojiPrefix"
              value={formData.emojiPrefix}
              onChange={(e) => setFormData({ ...formData, emojiPrefix: e.target.value })}
              placeholder="Вставьте эмодзи или символы"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">Категория</Label>
            <select
              id="categoryId"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-border bg-secondary text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              required
            >
              <option value="">Выберите категорию</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {isLiquidCategory && (
            <div className="space-y-2">
              <Label htmlFor="strengthLabel">Крепость (мг)</Label>
              <Input
                id="strengthLabel"
                value={formData.strengthLabel}
                onChange={(e) => setFormData({ ...formData, strengthLabel: e.target.value })}
                placeholder="50 mg"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="unitPrice">Цена продажи</Label>
            <Input
              id="unitPrice"
              type="number"
              step="0.01"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="flex items-center justify-between space-x-2 border border-border bg-secondary/50 p-3 rounded-lg">
            <Label htmlFor="isActive" className="flex flex-col space-y-1">
              <span>Активен</span>
              <span className="font-normal text-xs text-muted-foreground">
                Бренд виден в каталоге
              </span>
            </Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(c) => setFormData({ ...formData, isActive: c })}
            />
          </div>

          {/* Предпросмотр */}
          <div className="p-3 bg-secondary/50 rounded-lg border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Предпросмотр:</p>
            <div className="flex items-center gap-2">
              <span className="text-lg">{formData.emojiPrefix || '📦'}</span>
              <div>
                <p className="text-sm font-medium">{formData.name || 'Название бренда'}</p>
                {isLiquidCategory && formData.strengthLabel && (
                  <p className="text-xs text-muted-foreground">{formData.strengthLabel}</p>
                )}
                  <p className="text-xs text-muted-foreground">
                    {typeof formData.unitPrice === 'string' ? (formData.unitPrice || '0') : formData.unitPrice} • Активен: {formData.isActive ? 'Да' : 'Нет'}
                  </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={updateBrandMutation.isPending || deleteBrandMutation.isPending}
              className="sm:mr-auto"
            >
              <Trash2 size={16} className="mr-2" />
              Удалить
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={updateBrandMutation.isPending || deleteBrandMutation.isPending}>
                {updateBrandMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Диалог подтверждения удаления */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить бренд?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить бренд "{brand?.emojiPrefix} {brand?.name}"?
              <br />
              <br />
              Это действие нельзя отменить. Если в бренде есть форматы продуктов, удаление будет невозможно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteBrandMutation.isPending}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteBrandMutation.mutate()}
              disabled={deleteBrandMutation.isPending}
            >
              {deleteBrandMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
