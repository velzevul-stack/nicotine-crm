'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { getCurrencySymbol } from '@/lib/currency';
import { Trash2 } from 'lucide-react';

interface EditItemModalProps {
  item: any | null; // Full item object with flavor, stock, format details
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditItemModal({ item, open, onOpenChange }: EditItemModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: shopData } = useQuery({
    queryKey: ['shop'],
    queryFn: () => api<{ currency: string }>('/api/shop'),
    enabled: open,
  });
  const curLabel = getCurrencySymbol(shopData?.currency);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    costPrice: '' as number | string,
    unitPrice: '' as number | string,
    isActive: true,
    customValues: {} as Record<string, any>,
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.flavor.name,
        barcode: item.barcode || '',
        costPrice: item.costPrice || 0,
        unitPrice: item.format.unitPrice || 0,
        isActive: item.flavor.isActive,
        customValues: item.flavor.customValues || {},
      });
    }
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      api(`/api/inventory/flavor/${item.flavor.id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      
      // Формируем детальное сообщение о редактировании
      const brandName = item.brand?.name || '';
      const formatName = item.format?.name || '';
      const flavorName = variables.name || item.flavor.name;
      
      toast({ 
        title: 'Товар отредактирован',
        description: `Товар ${brandName} ${formatName} ${flavorName} успешно обновлён`,
        duration: 3000,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ 
        title: 'Ошибка обновления', 
        description: err.message || 'Не удалось обновить товар',
        variant: 'destructive' 
      });
    },
  });

  const deleteFlavorMutation = useMutation({
    mutationFn: async () => {
      if (!item) return;
      await api(`/api/inventory/flavor/${item.flavor.id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: 'Вкус удален',
        description: 'Вкус успешно удален',
      });
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка удаления',
        description: error.message || 'Не удалось удалить вкус',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const costPrice =
      typeof formData.costPrice === 'string'
        ? formData.costPrice === ''
          ? 0
          : parseFloat(formData.costPrice) || 0
        : formData.costPrice;
    if (costPrice < 0) {
      toast({
        title: 'Ошибка',
        description: 'Себестоимость (закупка) не может быть отрицательной',
        variant: 'destructive',
      });
      return;
    }
    const payload = {
      ...formData,
      costPrice: Math.max(0, costPrice),
      unitPrice: typeof formData.unitPrice === 'string' ? (formData.unitPrice === '' ? 0 : parseFloat(formData.unitPrice) || 0) : formData.unitPrice,
    };
    updateMutation.mutate(payload);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактирование товара</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название вкуса</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Dynamic Fields */}
          {item?.category?.customFields && item.category.customFields.length > 0 && (
            <div className="space-y-4 border-t pt-4 border-b pb-4">
              <Label className="text-base font-semibold">Характеристики</Label>
              {item.category.customFields
                .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
                .map((field: any) => {
                  // Skip fields that map to name if we already show name input?
                  // Actually, "name" input above maps to flavor.name.
                  // If a field maps to flavor_name, we should probably hide the generic "name" input 
                  // or sync them.
                  // For now, let's just render them and if they map to flavor_name, they update formData.name.
                  
                  return (
                  <div key={field.id} className="space-y-2">
                    <Label>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.type === 'select' ? (
                      <select
                        className="w-full h-10 rounded-md border border-border bg-secondary px-3 text-sm"
                        value={
                          field.target === 'flavor_name' ? formData.name :
                          // field.target === 'strength_label' ? formData.strengthLabel : // We don't have strengthLabel in formData yet, need to add if we want to edit it
                          formData.customValues?.[field.name] || ''
                        }
                        onChange={e => {
                          const val = e.target.value;
                          if (field.target === 'flavor_name') {
                            setFormData({...formData, name: val});
                          } else if (field.target === 'strength_label') {
                             // We need to handle strength label update. 
                             // Currently EditItemModal doesn't support editing format fields (strength) easily 
                             // because it affects all flavors in format.
                             // But user might want to.
                             // For now, let's just handle customValues and flavor_name.
                          } else {
                            setFormData({
                              ...formData,
                              customValues: {
                                ...formData.customValues,
                                [field.name]: val
                              }
                            });
                          }
                        }}
                        required={field.required}
                      >
                        <option value="">Выберите...</option>
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={
                          field.target === 'flavor_name' ? formData.name :
                          formData.customValues?.[field.name] || ''
                        }
                        onChange={e => {
                          const val = e.target.value;
                          if (field.target === 'flavor_name') {
                            setFormData({...formData, name: val});
                          } else {
                            setFormData({
                              ...formData,
                              customValues: {
                                ...formData.customValues,
                                [field.name]: val
                              }
                            });
                          }
                        }}
                        placeholder={field.label}
                        required={field.required}
                      />
                    )}
                  </div>
                )})}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Цена продажи ({curLabel})</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-[10px] text-muted-foreground">Влияет на весь формат {item.format.name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Себестоимость ({curLabel})</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min={0}
                value={formData.costPrice || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setFormData({ ...formData, costPrice: '' });
                    return;
                  }
                  const n = parseFloat(val);
                  setFormData({
                    ...formData,
                    costPrice: Number.isFinite(n) ? Math.max(0, n) : '',
                  });
                }}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.select();
                  }
                }}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Штрихкод</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="Сканируйте или введите..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between space-x-2 border border-border bg-secondary/50 p-3 rounded-lg">
            <Label htmlFor="active" className="flex flex-col space-y-1">
              <span>Активен</span>
              <span className="font-normal text-xs text-muted-foreground">
                Товар виден в каталоге
              </span>
            </Label>
            <Switch
              id="active"
              checked={formData.isActive}
              onCheckedChange={(c) => setFormData({ ...formData, isActive: c })}
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={updateMutation.isPending || deleteFlavorMutation.isPending}
              className="sm:mr-auto"
            >
              <Trash2 size={16} className="mr-2" />
              Удалить
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || deleteFlavorMutation.isPending}>
                {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Диалог подтверждения удаления */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить вкус?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить вкус "{item?.flavor?.name}"?
              <br />
              <br />
              Это действие нельзя отменить. Если на складе есть остатки товара, удаление будет невозможно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteFlavorMutation.isPending}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteFlavorMutation.mutate()}
              disabled={deleteFlavorMutation.isPending}
            >
              {deleteFlavorMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
