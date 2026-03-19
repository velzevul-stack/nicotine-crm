'use client';

import { useState, useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Copy, Filter, Lightbulb, Download, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { PostFiltersModal } from '@/components/post/PostFiltersModal';
import { ExcelSettingsModal } from '@/components/post/ExcelSettingsModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function PostGenerator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [selectedPostFormatId, setSelectedPostFormatId] = useState<string>('default');
  const [filters, setFilters] = useState({
    selectedCategories: [] as string[],
    selectedBrands: [] as string[],
    selectedStrengths: [] as string[],
    selectedColors: [] as string[],
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () =>
      api<{
        productFormats: any[];
        flavors: any[];
        brands: any[];
        categories: any[];
        items?: any[];
      }>('/api/inventory'),
  });

  const { data: postFormatsData } = useQuery({
    queryKey: ['post-formats'],
    queryFn: () => api<{ formats: Array<{ id: string; name: string; template: string; isActive: boolean }> }>('/api/post/formats'),
  });

  // Загружаем сохраненный формат поста из настроек магазина
  const { data: shopSettings } = useQuery({
    queryKey: ['shop-settings'],
    queryFn: () => api<{ defaultPostFormatId: string }>('/api/shop/settings'),
  });

  // Устанавливаем сохраненный формат при загрузке
  useEffect(() => {
    if (shopSettings?.defaultPostFormatId) {
      setSelectedPostFormatId(shopSettings.defaultPostFormatId);
    }
  }, [shopSettings]);

  // Сохраняем формат при изменении
  const saveFormatMutation = useMutation({
    mutationFn: (formatId: string) =>
      api('/api/shop/settings', {
        method: 'PATCH',
        body: { defaultPostFormatId: formatId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
    },
  });

  // Обработчик изменения формата
  const handleFormatChange = (formatId: string) => {
    setSelectedPostFormatId(formatId);
    saveFormatMutation.mutate(formatId);
  };

  const suggestFormatMutation = useMutation({
    mutationFn: (text: string) =>
      api('/api/post/suggest-format', {
        method: 'POST',
        body: { text },
      }),
    onSuccess: () => {
      toast({
        title: 'Предложение отправлено',
        description: 'Спасибо за ваше предложение! Мы рассмотрим его в ближайшее время.',
      });
      setShowSuggestModal(false);
      setSuggestionText('');
    },
    onError: () => {
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить предложение',
        variant: 'destructive',
      });
    },
  });

  const productFormats = Array.isArray(inventoryData?.productFormats) ? inventoryData.productFormats : [];
  const flavors = Array.isArray(inventoryData?.flavors) ? inventoryData.flavors : [];
  const brands = Array.isArray(inventoryData?.brands) ? inventoryData.brands : [];
  const categories = Array.isArray(inventoryData?.categories) ? inventoryData.categories : [];

  // Get unique strengths from formats
  const uniqueStrengths = [
    ...new Set(
      productFormats
        .map((f: any) => {
          const label = f.strengthLabel || '';
          return label.replace(/мг/gi, 'mg').trim();
        })
        .filter((s: string) => s)
    ),
  ].sort();

  // Get unique colors from flavors for device categories
  // Colors are stored in flavor.name for devices
  const deviceCategories = categories.filter((c: any) => {
    const name = c.name?.toLowerCase() || '';
    return (
      name.includes('устройств') ||
      name.includes('device') ||
      name.includes('pod') ||
      name.includes('мод')
    );
  });
  
  const items = Array.isArray(inventoryData?.items) ? inventoryData.items : [];
  const uniqueColors = deviceCategories.length > 0 && items.length > 0
    ? [
        ...new Set(
          items
            .filter((item: any) => 
              deviceCategories.some((dc: any) => dc.id === item.category?.id)
            )
            .map((item: any) => item.flavor?.name?.trim())
            .filter((color: string) => color)
        ),
      ].sort()
    : [];

  useEffect(() => {
    if (productFormats.length > 0 && brands.length > 0) {
      // Apply filters to format selection
      const filteredFormats = productFormats.filter((pf: any) => {
        const brand = brands.find((b: any) => b.id === pf.brandId);
        if (!brand) return false;
        
        if (filters.selectedCategories.length > 0 && !filters.selectedCategories.includes(brand.categoryId)) {
          return false;
        }
        if (filters.selectedBrands.length > 0 && !filters.selectedBrands.includes(brand.id)) {
          return false;
        }
        if (filters.selectedStrengths.length > 0) {
          const strength = (pf.strengthLabel || '').replace(/мг/gi, 'mg').trim();
          if (!filters.selectedStrengths.includes(strength)) {
            return false;
          }
        }
        // Фильтр по цвету: проверяем, есть ли у формата хотя бы один flavor с выбранным цветом
        if (filters.selectedColors.length > 0) {
          const formatFlavors = flavors.filter((f: any) => f.productFormatId === pf.id);
          const hasMatchingColor = formatFlavors.some((flavor: any) => 
            filters.selectedColors.includes(flavor.name.trim())
          );
          if (!hasMatchingColor) {
            return false;
          }
        }
        return true;
      });
      
    }
  }, [productFormats, brands, flavors, filters.selectedCategories, filters.selectedBrands, filters.selectedStrengths, filters.selectedColors]);

  // Apply filters to format selection
  const filteredFormats = productFormats.filter((pf: any) => {
    const brand = brands.find((b: any) => b.id === pf.brandId);
    if (!brand) return false;
    
    if (filters.selectedCategories.length > 0 && !filters.selectedCategories.includes(brand.categoryId)) {
      return false;
    }
    if (filters.selectedBrands.length > 0 && !filters.selectedBrands.includes(brand.id)) {
      return false;
    }
    if (filters.selectedStrengths.length > 0) {
      const strength = (pf.strengthLabel || '').replace(/мг/gi, 'mg').trim();
      if (!filters.selectedStrengths.includes(strength)) {
        return false;
      }
    }
    // Фильтр по цвету: проверяем, есть ли у формата хотя бы один flavor с выбранным цветом
    if (filters.selectedColors.length > 0) {
      const formatFlavors = flavors.filter((f: any) => f.productFormatId === pf.id);
      const hasMatchingColor = formatFlavors.some((flavor: any) => 
        filters.selectedColors.includes(flavor.name.trim())
      );
      if (!hasMatchingColor) {
        return false;
      }
    }
    return true;
  });

  const { data: postData } = useQuery({
    queryKey: ['post', filteredFormats.map((pf: any) => pf.id), filters, selectedPostFormatId],
    queryFn: () =>
      api<{ text: string }>('/api/post/generate', {
        method: 'POST',
        body: { 
          selectedFormatIds: filteredFormats.map((pf: any) => pf.id),
          categoryIds: filters.selectedCategories.length > 0 ? filters.selectedCategories : undefined,
          brandIds: filters.selectedBrands.length > 0 ? filters.selectedBrands : undefined,
          strengths: filters.selectedStrengths.length > 0 ? filters.selectedStrengths : undefined,
          colors: filters.selectedColors.length > 0 ? filters.selectedColors : undefined,
          postFormatId: selectedPostFormatId === 'default' ? undefined : selectedPostFormatId,
        },
      }),
    enabled: inventoryData !== undefined && filteredFormats.length > 0,
  });

  const hasActiveFilters =
    filters.selectedCategories.length > 0 ||
    filters.selectedBrands.length > 0 ||
    filters.selectedStrengths.length > 0 ||
    filters.selectedColors.length > 0;

  const postText = postData?.text ?? '';

  const handleCopy = () => {
    if (postText) {
      navigator.clipboard.writeText(postText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExport = () => {
    setShowExcelModal(true);
  };

  return (
    <>
      <ScreenHeader title="Пост в чат" subtitle="Генерация поста по наличию" />

      <div className="px-5 space-y-6 pb-6">
        {/* Format Selection + Filters */}
        <div className="space-y-3">
          <section>
            <label className="block text-foreground text-sm font-semibold mb-3">
              Формат поста
            </label>
            <Select value={selectedPostFormatId} onValueChange={handleFormatChange}>
              <SelectTrigger className="w-full h-12 rounded-[18px] bg-card">
                <SelectValue placeholder="Выберите формат" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Стандартный (по умолчанию)</SelectItem>
                {postFormatsData?.formats.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    {format.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/post/formats')}
                className="rounded-[12px]"
              >
                <FileText size={14} className="mr-1.5" />
                Форматы
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSuggestModal(true)}
                className="rounded-[12px]"
              >
                <Lightbulb size={14} className="mr-1.5" />
                Предложить формат
              </Button>
            </div>
          </section>

          <section className="space-y-3">
          <Button
            variant="default"
            size="lg"
            className="w-full h-12 rounded-[18px] font-semibold"
            onClick={() => setShowFilterModal(true)}
          >
            <Filter size={18} className="mr-2" />
            Фильтры
            {hasActiveFilters && (
              <span className="ml-1.5 px-2 py-0.5 bg-[#0F1115]/20 text-[#111111] rounded-full text-xs font-semibold">
                {filters.selectedCategories.length + filters.selectedBrands.length + filters.selectedStrengths.length + filters.selectedColors.length}
              </span>
            )}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="default"
              size="lg"
              className="h-12 rounded-[18px] font-semibold"
              onClick={handleCopy}
              disabled={!postText}
            >
              <Copy size={18} className="mr-2" />
              {copied ? 'Скопировано!' : 'Копировать'}
            </Button>
            <Button
              variant="default"
              size="lg"
              className="h-12 rounded-[18px] font-semibold"
              onClick={handleExport}
            >
              <Download size={18} className="mr-2" />
              Excel
            </Button>
          </div>
          </section>
        </div>

        {/* Post - always visible under buttons */}
        <section>
          <div className="bg-[#151922] rounded-[24px] p-6 border border-[#1B2030]">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-[#F5F5F7] min-h-[120px]">
              {postText || (filteredFormats.length === 0 ? 'Нет товаров по выбранным фильтрам' : 'Загрузка...')}
            </pre>
          </div>
        </section>

        <PostFiltersModal
          open={showFilterModal}
          onOpenChange={setShowFilterModal}
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          brands={brands}
          strengths={uniqueStrengths}
          colors={uniqueColors}
        />

        <ExcelSettingsModal
          open={showExcelModal}
          onOpenChange={setShowExcelModal}
          brands={brands}
          onBrandPhotoUploaded={() => queryClient.invalidateQueries({ queryKey: ['inventory'] })}
        />

        <Dialog open={showSuggestModal} onOpenChange={setShowSuggestModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Предложить новый формат поста</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Опишите желаемый формат</Label>
                <Textarea
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  placeholder="Например: Сделайте формат, где цена жирным шрифтом и смайлик огня. Или опишите структуру поста..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Опишите, как должен выглядеть пост. Можно указать пример текста или структуру.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSuggestModal(false)}>
                Отмена
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  if (suggestionText.trim().length < 10) {
                    toast({
                      title: 'Ошибка',
                      description: 'Предложение должно содержать минимум 10 символов',
                      variant: 'destructive',
                    });
                    return;
                  }
                  suggestFormatMutation.mutate(suggestionText.trim());
                }}
                disabled={suggestFormatMutation.isPending}
              >
                {suggestFormatMutation.isPending ? 'Отправка...' : 'Отправить'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
