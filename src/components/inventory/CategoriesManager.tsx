'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useHintSeen } from '@/hooks/use-hint-seen';
import { Plus, Edit2, Trash2, GripVertical, ChevronUp, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface CategoryField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  options?: string[];
  sortOrder: number;
  target?: 'flavor_name' | 'strength_label' | 'custom';
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  sortOrder: number;
  customFields?: CategoryField[];
}

const POPULAR_EMOJIS = [
  '📦', '💨', '🔋', '🔧', '🚬', '❄️', '🌲', '⚡', '🔥',
  '💧', '🍓', '🍋', '🍇', '🍌', '🍎', '🍊', '🍑', '🥭', '🍒',
  '⭐', '🌟', '✨', '💫', '🎯', '🎨', '🎭', '🎪', '🎬', '🎮',
];

interface CategoriesManagerProps {
  autoOpenCreate?: boolean;
  onCreateComplete?: () => void;
}

export function CategoriesManager({ autoOpenCreate = false, onCreateComplete }: CategoriesManagerProps = {}) {
  const { toast } = useToast();
  const [showHint] = useHintSeen('categories-options');
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', emoji: '📦', customFields: [] as CategoryField[] });
  const [editingField, setEditingField] = useState<CategoryField | null>(null);
  const [showAddFieldForm, setShowAddFieldForm] = useState(false);
  const [fieldFormData, setFieldFormData] = useState({
    name: '',
    label: '',
    type: 'text' as 'text' | 'number' | 'select',
    required: false,
    options: [] as string[],
    optionsInput: '',
    target: 'custom' as 'flavor_name' | 'strength_label' | 'custom',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ categories: Category[] }>('/api/inventory/categories'),
  });

  // Загружаем инвентарь для анализа существующих полей
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api<any>('/api/inventory'),
    enabled: !!editingCategory, // Загружаем только когда редактируем категорию
  });

  // Автоматическое открытие формы создания при монтировании, если autoOpenCreate = true
  useEffect(() => {
    if (autoOpenCreate && !showCreateDialog) {
      setShowCreateDialog(true);
    }
  }, [autoOpenCreate]);

  // Очистка состояния при закрытии диалога создания
  useEffect(() => {
    if (!showCreateDialog) {
      setFormData({ name: '', emoji: '📦', customFields: [] });
      setEditingField(null);
      setShowAddFieldForm(false);
      setFieldFormData({
        name: '',
        label: '',
        type: 'text',
        required: false,
        options: [],
        optionsInput: '',
        target: 'custom',
      });
      // Вызываем callback после закрытия диалога, если он был открыт автоматически
      if (autoOpenCreate && onCreateComplete) {
        onCreateComplete();
      }
    }
  }, [showCreateDialog, autoOpenCreate, onCreateComplete]);

  // Очистка состояния при закрытии диалога редактирования
  useEffect(() => {
    if (!editingCategory) {
      setEditingField(null);
      setShowAddFieldForm(false);
      setFieldFormData({
        name: '',
        label: '',
        type: 'text',
        required: false,
        options: [],
        optionsInput: '',
        target: 'custom',
      });
    }
  }, [editingCategory]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; emoji: string; customFields?: CategoryField[] }) =>
      api('/api/inventory/categories', {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setShowCreateDialog(false);
      setFormData({ name: '', emoji: '📦', customFields: [] });
      setEditingField(null);
      setFieldFormData({
        name: '',
        label: '',
        type: 'text',
        required: false,
        options: [],
        optionsInput: '',
        target: 'custom',
      });
      toast({ title: 'Категория создана', description: 'Категория успешно добавлена' });
      // Вызываем callback после успешного создания, если он был открыт автоматически
      if (autoOpenCreate && onCreateComplete) {
        onCreateComplete();
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать категорию',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; emoji?: string; sortOrder?: number; customFields?: CategoryField[] }) =>
      api('/api/inventory/categories', {
        method: 'PATCH',
        body: { id, ...data },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setEditingCategory(null);
      toast({ title: 'Категория обновлена', description: 'Изменения сохранены' });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось обновить категорию',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/categories?id=${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setDeletingCategory(null);
      toast({ title: 'Категория удалена', description: 'Категория успешно удалена' });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить категорию',
        variant: 'destructive',
      });
    },
  });

  // Нормализуем категории - убеждаемся что customFields всегда массив
  const categories = (data?.categories || []).map(cat => ({
    ...cat,
    customFields: Array.isArray(cat.customFields) ? cat.customFields : [],
  }));

  // Функция для определения стандартных полей на основе названия категории
  const getDefaultFieldsForCategory = (categoryName: string): CategoryField[] => {
    const nameLower = categoryName.toLowerCase();
    const fields: CategoryField[] = [];
    let sortOrder = 0;

    if (nameLower.includes('жидкост') || nameLower.includes('liquid')) {
      fields.push({
        id: 'default-strength',
        name: 'strength',
        label: 'Крепость',
        type: 'text',
        required: false,
        sortOrder: sortOrder++,
        target: 'strength_label',
      });
      fields.push({
        id: 'default-flavor',
        name: 'flavor',
        label: 'Вкус',
        type: 'text',
        required: true,
        sortOrder: sortOrder++,
        target: 'flavor_name',
      });
    } else if (nameLower.includes('устройств') || nameLower.includes('device')) {
      fields.push({
        id: 'default-color',
        name: 'color',
        label: 'Цвет',
        type: 'text',
        required: true,
        sortOrder: sortOrder++,
        target: 'flavor_name',
      });
    } else if (nameLower.includes('расходник') || nameLower.includes('consumable')) {
      fields.push({
        id: 'default-ohms',
        name: 'ohms',
        label: 'Омы',
        type: 'text',
        required: true,
        sortOrder: sortOrder++,
        target: 'strength_label',
      });
      fields.push({
        id: 'default-quantity',
        name: 'quantity',
        label: 'Количество',
        type: 'text',
        required: false,
        sortOrder: sortOrder++,
        target: 'flavor_name',
      });
    } else if (nameLower.includes('снюс') || nameLower.includes('snus')) {
      fields.push({
        id: 'default-strength',
        name: 'strength',
        label: 'Крепость',
        type: 'text',
        required: true,
        sortOrder: sortOrder++,
        target: 'strength_label',
      });
      fields.push({
        id: 'default-flavor',
        name: 'flavor',
        label: 'Вкус',
        type: 'text',
        required: true,
        sortOrder: sortOrder++,
        target: 'flavor_name',
      });
    } else if (nameLower.includes('одноразк') || nameLower.includes('disposable')) {
      fields.push({
        id: 'default-strength',
        name: 'strength',
        label: 'Крепость',
        type: 'text',
        required: false,
        sortOrder: sortOrder++,
        target: 'strength_label',
      });
      fields.push({
        id: 'default-flavor',
        name: 'flavor',
        label: 'Вкус',
        type: 'text',
        required: true,
        sortOrder: sortOrder++,
        target: 'flavor_name',
      });
    }

    return fields;
  };

  // Функция для получения существующих полей из товаров категории
  const getExistingFieldsFromProducts = (categoryId: string): CategoryField[] => {
    if (!inventoryData?.items) return [];

    const categoryItems = inventoryData.items.filter((item: any) => item.category?.id === categoryId);
    if (categoryItems.length === 0) return [];

    const existingFields: Map<string, CategoryField> = new Map();
    let sortOrder = 0;

    // Анализируем товары
    categoryItems.forEach((item: any) => {
      // Проверяем strengthLabel (крепость/омы)
      if (item.format?.strengthLabel) {
        const key = 'strength_label';
        if (!existingFields.has(key)) {
          existingFields.set(key, {
            id: `existing-${key}`,
            name: 'strength',
            label: 'Крепость/Омы',
            type: 'text',
            required: false,
            sortOrder: sortOrder++,
            target: 'strength_label',
          });
        }
      }

      // Проверяем flavor name (вкус/цвет)
      if (item.flavor?.name && item.flavor.name.trim()) {
        const key = 'flavor_name';
        if (!existingFields.has(key)) {
          const categoryName = item.category?.name?.toLowerCase() || '';
          const label = categoryName.includes('устройств') || categoryName.includes('device') 
            ? 'Цвет' 
            : 'Вкус';
          
          existingFields.set(key, {
            id: `existing-${key}`,
            name: 'flavor',
            label: label,
            type: 'text',
            required: true,
            sortOrder: sortOrder++,
            target: 'flavor_name',
          });
        }
      }
    });

    return Array.from(existingFields.values());
  };

  // Получаем все поля (настроенные + существующие + стандартные)
  const getAllFieldsForCategory = (category: Category | null): CategoryField[] => {
    if (!category) return [];

    const configuredFields = Array.isArray(category.customFields) ? category.customFields : [];
    const configuredFieldNames = new Set(configuredFields.map(f => f.target || f.name));

    // Получаем существующие поля из товаров
    const existingFields = getExistingFieldsFromProducts(category.id).filter(
      field => !configuredFieldNames.has(field.target || field.name)
    );

    // Если нет настроенных полей, показываем стандартные
    if (configuredFields.length === 0 && existingFields.length === 0) {
      return getDefaultFieldsForCategory(category.name);
    }

    // Объединяем настроенные и существующие поля
    return [...configuredFields, ...existingFields];
  };

  const handleMoveUp = async (category: Category, index: number) => {
    if (index === 0) return;
    const prevCategory = categories[index - 1];
    // Меняем местами sortOrder через Promise.all для атомарности
    try {
      await Promise.all([
        api('/api/inventory/categories', {
          method: 'PATCH',
          body: { id: category.id, sortOrder: prevCategory.sortOrder },
        }),
        api('/api/inventory/categories', {
          method: 'PATCH',
          body: { id: prevCategory.id, sortOrder: category.sortOrder },
        }),
      ]);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось изменить порядок',
        variant: 'destructive',
      });
    }
  };

  const handleMoveDown = async (category: Category, index: number) => {
    if (index === categories.length - 1) return;
    const nextCategory = categories[index + 1];
    // Меняем местами sortOrder через Promise.all для атомарности
    try {
      await Promise.all([
        api('/api/inventory/categories', {
          method: 'PATCH',
          body: { id: category.id, sortOrder: nextCategory.sortOrder },
        }),
        api('/api/inventory/categories', {
          method: 'PATCH',
          body: { id: nextCategory.id, sortOrder: category.sortOrder },
        }),
      ]);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось изменить порядок',
        variant: 'destructive',
      });
    }
  };


  const handleEdit = (category: Category) => {
    // Получаем актуальные данные категории из запроса (на случай если они обновились)
    const freshCategory = data?.categories?.find(c => c.id === category.id) || category;
    
    // Нормализуем customFields - всегда массив, валидируем структуру
    const normalizedFields: CategoryField[] = Array.isArray(freshCategory.customFields)
      ? freshCategory.customFields
          .filter((field): field is CategoryField => 
            field && 
            typeof field === 'object' &&
            typeof field.id === 'string' &&
            typeof field.name === 'string' &&
            typeof field.label === 'string' &&
            ['text', 'number', 'select'].includes(field.type) &&
            typeof field.required === 'boolean' &&
            typeof field.sortOrder === 'number'
          )
          .map(field => ({
            id: field.id,
            name: field.name.trim(),
            label: field.label.trim(),
            type: field.type,
            required: Boolean(field.required),
            options: field.type === 'select' && Array.isArray(field.options) 
              ? field.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
              : undefined,
            sortOrder: Number(field.sortOrder) || 0,
            target: (field as any).target || 'custom',
          }))
      : [];
    
    setEditingCategory(freshCategory);
    setFormData({ 
      name: freshCategory.name || '', 
      emoji: freshCategory.emoji || '📦',
      customFields: normalizedFields
    });
    setShowAddFieldForm(false);
    setEditingField(null);
  };

  const handleUpdate = () => {
    if (!editingCategory || !formData.name.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название категории',
        variant: 'destructive',
      });
      return;
    }

    // Если открыта форма редактирования поля, закрываем её сначала
    if (editingField || showAddFieldForm) {
      toast({
        title: 'Внимание',
        description: 'Завершите редактирование поля перед сохранением категории',
        variant: 'destructive',
      });
      return;
    }

    // Валидация полей перед сохранением
    const fieldsToSave = Array.isArray(formData.customFields) ? formData.customFields : [];
    
    // Проверка на дубликаты ID полей
    const fieldIds = fieldsToSave.map(f => f.id);
    const duplicateIds = fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      toast({
        title: 'Ошибка',
        description: `Обнаружены дубликаты ID полей. Пожалуйста, удалите дубликаты или обновите страницу.`,
        variant: 'destructive',
      });
      return;
    }
    
    // Проверка на дубликаты имен полей (name)
    const fieldNames = fieldsToSave.map(f => f.name.toLowerCase().trim());
    const duplicateNames = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      toast({
        title: 'Ошибка',
        description: `Обнаружены дубликаты названий полей: ${[...new Set(duplicateNames)].join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    // Проверка на дубликаты назначений (target) - не должно быть двух полей с одинаковым target
    const fieldTargets = fieldsToSave
      .filter(f => f.target && f.target !== 'custom')
      .map(f => f.target);
    const duplicateTargets = fieldTargets.filter((target, index) => fieldTargets.indexOf(target) !== index);
    if (duplicateTargets.length > 0) {
      toast({
        title: 'Ошибка',
        description: `Не может быть несколько полей с одинаковым назначением: ${[...new Set(duplicateTargets)].join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    // Валидация структуры полей
    const invalidFields = fieldsToSave.filter(f => 
      !f.name.trim() || !f.label.trim() || !['text', 'number', 'select'].includes(f.type)
    );
    if (invalidFields.length > 0) {
      toast({
        title: 'Ошибка',
        description: 'Некоторые поля содержат некорректные данные. Проверьте все поля перед сохранением.',
        variant: 'destructive',
      });
      return;
    }

    // Валидация полей типа select - должны быть варианты
    const invalidSelectFields = fieldsToSave.filter(f => 
      f.type === 'select' && (!f.options || f.options.length === 0)
    );
    if (invalidSelectFields.length > 0) {
      toast({
        title: 'Ошибка',
        description: 'Поля типа "Выбор из списка" должны содержать варианты выбора',
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate({
      id: editingCategory.id,
      name: formData.name.trim(),
      emoji: formData.emoji || '📦',
      customFields: fieldsToSave,
    });
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название категории',
        variant: 'destructive',
      });
      return;
    }

    // Валидация полей перед сохранением (такая же как в handleUpdate)
    const fieldsToSave = Array.isArray(formData.customFields) ? formData.customFields : [];
    
    // Проверка на дубликаты ID полей
    const fieldIds = fieldsToSave.map(f => f.id);
    const duplicateIds = fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      toast({
        title: 'Ошибка',
        description: `Обнаружены дубликаты ID полей. Пожалуйста, удалите дубликаты.`,
        variant: 'destructive',
      });
      return;
    }
    
    // Проверка на дубликаты имен полей (name) - используем Map для более точной проверки
    const fieldNamesMap = new Map<string, { id: string; label: string }>();
    const duplicateNames: Array<{ name: string; labels: string[] }> = [];
    for (const field of fieldsToSave) {
      const normalizedName = field.name.toLowerCase().trim();
      if (!normalizedName) continue; // Пропускаем пустые имена
      
      if (fieldNamesMap.has(normalizedName)) {
        const existing = fieldNamesMap.get(normalizedName)!;
        const dup = duplicateNames.find(d => d.name === normalizedName);
        if (dup) {
          if (!dup.labels.includes(field.label)) {
            dup.labels.push(field.label);
          }
        } else {
          duplicateNames.push({
            name: normalizedName,
            labels: [existing.label, field.label]
          });
        }
      } else {
        fieldNamesMap.set(normalizedName, { id: field.id, label: field.label });
      }
    }
    if (duplicateNames.length > 0) {
      const dupMessages = duplicateNames.map(d => 
        `"${d.name}" (используется в: ${d.labels.join(', ')})`
      );
      toast({
        title: 'Ошибка валидации',
        description: `Обнаружены дубликаты названий полей:\n${dupMessages.join('\n')}\n\nИзмените название одного из полей.`,
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }

    // Проверка на дубликаты назначений (target)
    const fieldTargets = fieldsToSave
      .filter(f => f.target && f.target !== 'custom')
      .map(f => f.target);
    const duplicateTargets = fieldTargets.filter((target, index) => fieldTargets.indexOf(target) !== index);
    if (duplicateTargets.length > 0) {
      toast({
        title: 'Ошибка',
        description: `Не может быть несколько полей с одинаковым назначением: ${[...new Set(duplicateTargets)].join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    // Валидация структуры полей
    const invalidFields = fieldsToSave.filter(f => 
      !f.name.trim() || !f.label.trim() || !['text', 'number', 'select'].includes(f.type)
    );
    if (invalidFields.length > 0) {
      toast({
        title: 'Ошибка',
        description: 'Некоторые поля содержат некорректные данные. Проверьте все поля перед сохранением.',
        variant: 'destructive',
      });
      return;
    }

    // Валидация полей типа select
    const invalidSelectFields = fieldsToSave.filter(f => 
      f.type === 'select' && (!f.options || f.options.length === 0)
    );
    if (invalidSelectFields.length > 0) {
      toast({
        title: 'Ошибка',
        description: 'Поля типа "Выбор из списка" должны содержать варианты выбора',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({
      name: formData.name.trim(),
      emoji: formData.emoji || '📦',
      customFields: fieldsToSave,
    });
  };

  const addField = () => {
    // Валидация обязательных полей
    const fieldName = fieldFormData.name.trim();
    const fieldLabel = fieldFormData.label.trim();
    
    if (!fieldName || !fieldLabel) {
      toast({
        title: 'Ошибка',
        description: 'Заполните название и метку поля',
        variant: 'destructive',
      });
      return;
    }

    // Проверка на дубликаты имени поля (name должен быть уникальным)
    const nameExists = formData.customFields.some(
      f => f.name.toLowerCase() === fieldName.toLowerCase() && f.id !== editingField?.id
    );
    if (nameExists) {
      toast({
        title: 'Ошибка',
        description: `Поле с названием "${fieldName}" уже существует`,
        variant: 'destructive',
      });
      return;
    }

    // Проверка на дубликаты назначения (target), если это не custom
    if (fieldFormData.target && fieldFormData.target !== 'custom') {
      const targetExists = formData.customFields.some(
        f => f.target === fieldFormData.target && f.id !== editingField?.id
      );
      if (targetExists) {
        const targetLabel = fieldFormData.target === 'flavor_name' 
          ? 'Основной вариант (Вкус/Цвет)' 
          : 'Характеристика (Крепость/Омы)';
        toast({
          title: 'Ошибка',
          description: `Поле с назначением "${targetLabel}" уже существует. Может быть только одно такое поле.`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Валидация для типа select - должны быть варианты
    if (fieldFormData.type === 'select') {
      const options = fieldFormData.optionsInput.trim()
        ? fieldFormData.optionsInput.split(',').map(o => o.trim()).filter(o => o)
        : [];
      if (options.length === 0) {
        toast({
          title: 'Ошибка',
          description: 'Для типа "Выбор из списка" необходимо указать хотя бы один вариант',
          variant: 'destructive',
        });
        return;
      }
    }

    const options = fieldFormData.type === 'select' && fieldFormData.optionsInput.trim()
      ? fieldFormData.optionsInput.split(',').map(o => o.trim()).filter(o => o)
      : undefined;

    // Генерируем уникальный ID с проверкой на дубликаты
    const generateUniqueId = (): string => {
      const existingIds = new Set(formData.customFields.map(f => f.id));
      let newId: string;
      do {
        newId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      } while (existingIds.has(newId));
      return newId;
    };

    const newField: CategoryField = {
      id: generateUniqueId(),
      name: fieldName,
      label: fieldLabel,
      type: fieldFormData.type,
      required: Boolean(fieldFormData.required),
      options,
      sortOrder: formData.customFields.length,
      target: fieldFormData.target,
    };

    setFormData({
      ...formData,
      customFields: [...formData.customFields, newField],
    });

    setFieldFormData({
      name: '',
      label: '',
      type: 'text',
      required: false,
      options: [],
      optionsInput: '',
      target: 'custom',
    });
    setEditingField(null);
    setShowAddFieldForm(false);
  };

  const removeField = (fieldId: string) => {
    setFormData({
      ...formData,
      customFields: formData.customFields.filter(f => f.id !== fieldId),
    });
  };

  const editField = (field: CategoryField) => {
    setEditingField(field);
    setShowAddFieldForm(false);
    setFieldFormData({
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options || [],
      optionsInput: field.options?.join(', ') || '',
      target: (field.target || 'custom') as 'flavor_name' | 'strength_label' | 'custom',
    });
  };

  const updateField = () => {
    if (!editingField) {
      toast({
        title: 'Ошибка',
        description: 'Поле для редактирования не выбрано',
        variant: 'destructive',
      });
      return;
    }

    // Валидация обязательных полей
    const fieldName = fieldFormData.name.trim();
    const fieldLabel = fieldFormData.label.trim();
    
    if (!fieldName || !fieldLabel) {
      toast({
        title: 'Ошибка',
        description: 'Заполните название и метку поля',
        variant: 'destructive',
      });
      return;
    }

    // Проверка на дубликаты имени поля (кроме текущего редактируемого)
    const nameExists = formData.customFields.some(
      f => f.name.toLowerCase() === fieldName.toLowerCase() && f.id !== editingField.id
    );
    if (nameExists) {
      toast({
        title: 'Ошибка',
        description: `Поле с названием "${fieldName}" уже существует`,
        variant: 'destructive',
      });
      return;
    }

    // Проверка на дубликаты назначения (target), если это не custom
    if (fieldFormData.target && fieldFormData.target !== 'custom') {
      const targetExists = formData.customFields.some(
        f => f.target === fieldFormData.target && f.id !== editingField.id
      );
      if (targetExists) {
        const targetLabel = fieldFormData.target === 'flavor_name' 
          ? 'Основной вариант (Вкус/Цвет)' 
          : 'Характеристика (Крепость/Омы)';
        toast({
          title: 'Ошибка',
          description: `Поле с назначением "${targetLabel}" уже существует. Может быть только одно такое поле.`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Валидация для типа select - должны быть варианты
    if (fieldFormData.type === 'select') {
      const options = fieldFormData.optionsInput.trim()
        ? fieldFormData.optionsInput.split(',').map(o => o.trim()).filter(o => o)
        : [];
      if (options.length === 0) {
        toast({
          title: 'Ошибка',
          description: 'Для типа "Выбор из списка" необходимо указать хотя бы один вариант',
          variant: 'destructive',
        });
        return;
      }
    }

    const options = fieldFormData.type === 'select' && fieldFormData.optionsInput.trim()
      ? fieldFormData.optionsInput.split(',').map(o => o.trim()).filter(o => o)
      : undefined;

    setFormData({
      ...formData,
      customFields: formData.customFields.map(f =>
        f.id === editingField.id
          ? {
              ...f,
              name: fieldName,
              label: fieldLabel,
              type: fieldFormData.type,
              required: Boolean(fieldFormData.required),
              options,
              target: fieldFormData.target,
            }
          : f
      ),
    });

    setFieldFormData({
      name: '',
      label: '',
      type: 'text',
      required: false,
      options: [],
      optionsInput: '',
      target: 'custom',
    });
    setEditingField(null);
    setShowAddFieldForm(false);
  };

  const handleDelete = () => {
    if (deletingCategory) {
      deleteMutation.mutate(deletingCategory.id);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Категории</h2>
          <p className="text-sm text-muted-foreground">
            Управляйте категориями товаров в вашем магазине
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="w-full shrink-0 sm:w-auto">
          <Plus size={16} className="mr-2" />
          Добавить категорию
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <p className="mb-2">Нет категорий</p>
          <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
            Создать первую категорию
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-3 p-3 border rounded-lg hover:bg-secondary/50 transition-colors sm:flex-row sm:items-center min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <GripVertical className="text-muted-foreground shrink-0" size={16} />
                  <span className="text-xl shrink-0">{category.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium break-words">{category.name}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      Порядок: {category.sortOrder}
                      {category.customFields && category.customFields.length > 0 && (
                        <span> • Полей: {category.customFields.length}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 justify-end flex-wrap sm:justify-start">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveUp(category, index)}
                    disabled={index === 0}
                    className="h-8 w-8"
                    title="Переместить вверх"
                  >
                    <ChevronUp size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveDown(category, index)}
                    disabled={index === categories.length - 1}
                    className="h-8 w-8"
                    title="Переместить вниз"
                  >
                    <ChevronDown size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(category)}
                    className="h-8 w-8"
                  >
                    <Edit2 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingCategory(category)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog 
        open={showCreateDialog} 
        onOpenChange={(open) => {
          setShowCreateDialog(open);
        }}
      >
        <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Создать категорию</DialogTitle>
            <DialogDescription>
              Добавьте новую категорию для организации товаров
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 min-w-0">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Жидкости"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Эмодзи</Label>
              <div className="space-y-2">
                <Input
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  placeholder="📦"
                  maxLength={10}
                />
                <div className="flex flex-wrap gap-2">
                  {POPULAR_EMOJIS.map((emoji, index) => (
                    <button
                      key={`${emoji}-${index}`}
                      type="button"
                      onClick={() => setFormData({ ...formData, emoji })}
                      className={`text-xl p-2 rounded hover:bg-secondary transition-colors ${
                        formData.emoji === emoji ? 'bg-primary/20 ring-2 ring-primary' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Fields Section */}
            <div className="space-y-3 border-t pt-4 min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <Label className="text-base font-semibold">Поля категории</Label>
                  <p className="text-sm text-muted-foreground">
                    Настройте поля, которые нужно заполнять при добавлении товаров в эту категорию
                  </p>
                  {showHint && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                      <p className="text-xs text-blue-900 dark:text-blue-200 font-medium mb-1">Подсказка:</p>
                      <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5 list-disc list-inside">
                        <li><strong>Основной вариант</strong> — для вкуса, цвета или модели (отображается внизу: "• Значение")</li>
                        <li><strong>Характеристика</strong> — для крепости, омов, мощности (отображается рядом с брендом)</li>
                        <li><strong>Дополнительное поле</strong> — для любой другой информации (сохраняется, но не отображается в посте)</li>
                      </ul>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={() => {
                    setEditingField(null);
                    setShowAddFieldForm(true);
                    setFieldFormData({
                      name: '',
                      label: '',
                      type: 'text',
                      required: false,
                      options: [],
                      optionsInput: '',
                      target: 'custom',
                    });
                  }}
                >
                  <Plus size={16} className="mr-2" />
                  Добавить поле
                </Button>
              </div>

              {/* Existing Fields List */}
              {formData.customFields.length > 0 && (
                <div className="space-y-2">
                  {formData.customFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex flex-col gap-3 p-3 border rounded-lg bg-secondary/30 min-w-0 sm:flex-row sm:items-center"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium break-words">{field.label}</span>
                          <span className="text-xs text-muted-foreground shrink-0">({field.name})</span>
                          {field.required && (
                            <span className="text-xs text-destructive">*</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 break-words">
                          Тип: {field.type === 'text' ? 'Текст' : field.type === 'number' ? 'Число' : 'Выбор'}
                          {field.options && field.options.length > 0 && (
                            <span> • Варианты: {field.options.join(', ')}</span>
                          )}
                          {field.target && (
                            <span> • Назначение: {
                              field.target === 'flavor_name' ? 'Основной вариант (Вкус/Цвет)' :
                              field.target === 'strength_label' ? 'Характеристика (Крепость/Омы)' :
                              'Дополнительное поле'
                            }</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => editField(field)}
                          className="h-8 w-8"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeField(field.id)}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/Edit Field Form */}
              {showAddFieldForm || editingField ? (
                <div className="border rounded-lg p-3 space-y-3 bg-secondary/20 min-w-0 sm:p-4">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <Label className="text-sm font-semibold min-w-0 break-words">
                      {editingField ? 'Редактировать поле' : 'Новое поле'}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setEditingField(null);
                        setShowAddFieldForm(false);
                        setFieldFormData({
                          name: '',
                          label: '',
                          type: 'text',
                          required: false,
                          options: [],
                          optionsInput: '',
                          target: 'custom',
                        });
                      }}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs">Название поля (ID)</Label>
                      <Input
                        value={fieldFormData.name}
                        onChange={(e) => setFieldFormData({ ...fieldFormData, name: e.target.value })}
                        placeholder="например: strength"
                        disabled={!!editingField}
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs">Метка (отображаемое название)</Label>
                      <Input
                        value={fieldFormData.label}
                        onChange={(e) => setFieldFormData({ ...fieldFormData, label: e.target.value })}
                        placeholder="например: Крепость"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs">Тип поля</Label>
                      <Select
                        value={fieldFormData.type}
                        onValueChange={(value: 'text' | 'number' | 'select') =>
                          setFieldFormData({ ...fieldFormData, type: value })
                        }
                      >
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Текст</SelectItem>
                          <SelectItem value="number">Число</SelectItem>
                          <SelectItem value="select">Выбор из списка</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 flex items-end">
                      <div className="flex items-center gap-2 w-full">
                        <Switch
                          checked={fieldFormData.required}
                          onCheckedChange={(checked) =>
                            setFieldFormData({ ...fieldFormData, required: checked })
                          }
                        />
                        <Label className="text-xs">Обязательное поле</Label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Назначение поля</Label>
                    <Select
                      value={fieldFormData.target}
                      onValueChange={(value: 'flavor_name' | 'strength_label' | 'custom') =>
                        setFieldFormData({ ...fieldFormData, target: value })
                      }
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Дополнительное поле</SelectItem>
                        <SelectItem value="flavor_name">Основной вариант (Вкус/Цвет)</SelectItem>
                        <SelectItem value="strength_label">Характеристика (Крепость/Омы)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1 break-words">
                      {fieldFormData.target === 'flavor_name' && 'Это поле будет отображаться в нижней строке товара (например: "• Клубника")'}
                      {fieldFormData.target === 'strength_label' && 'Это поле будет отображаться рядом с названием бренда (например: "Brand 20mg")'}
                      {fieldFormData.target === 'custom' && 'Это поле будет сохранено как дополнительная информация о товаре'}
                    </p>
                  </div>
                  {fieldFormData.type === 'select' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Варианты (через запятую)</Label>
                      <Input
                        value={fieldFormData.optionsInput}
                        onChange={(e) =>
                          setFieldFormData({ ...fieldFormData, optionsInput: e.target.value })
                        }
                        placeholder="например: 20 мг, 30 мг, 50 мг"
                      />
                    </div>
                  )}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {(editingField || showAddFieldForm) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setEditingField(null);
                          setShowAddFieldForm(false);
                          setFieldFormData({
                            name: '',
                            label: '',
                            type: 'text',
                            required: false,
                            options: [],
                            optionsInput: '',
                            target: 'custom',
                          });
                        }}
                      >
                        Отмена
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={editingField ? updateField : addField}
                      disabled={!fieldFormData.name.trim() || !fieldFormData.label.trim()}
                    >
                      {editingField ? 'Сохранить' : 'Добавить'}
                    </Button>
                  </div>
                </div>
              ) : formData.customFields.length === 0 ? (
                <div className="text-center py-6 text-sm border rounded-lg bg-muted/30">
                  <p className="text-muted-foreground mb-2">Нет настроенных полей</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Нажмите кнопку "Добавить поле" выше, чтобы создать первое поле для этой категории
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Например: для жидкостей можно добавить поля "Вкус" (Основной вариант) и "Крепость" (Характеристика)
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowCreateDialog(false)}>
              Отмена
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleCreate}
              disabled={createMutation.isPending || !formData.name.trim()}
            >
              {createMutation.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog 
        open={!!editingCategory} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingCategory(null);
          }
        }}
      >
        <DialogContent className="glass-card border-border max-w-[95vw] sm:max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Редактировать категорию</DialogTitle>
            <DialogDescription>Измените название, эмодзи и настройте поля категории</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 min-w-0">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Жидкости"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Эмодзи</Label>
              <div className="space-y-2">
                <Input
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  placeholder="📦"
                  maxLength={10}
                />
                <div className="flex flex-wrap gap-2">
                  {POPULAR_EMOJIS.map((emoji, index) => (
                    <button
                      key={`${emoji}-${index}`}
                      type="button"
                      onClick={() => setFormData({ ...formData, emoji })}
                      className={`text-xl p-2 rounded hover:bg-secondary transition-colors ${
                        formData.emoji === emoji ? 'bg-primary/20 ring-2 ring-primary' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Fields Section */}
            <div className="space-y-3 border-t pt-4 min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <Label className="text-base font-semibold">Поля категории</Label>
                  <p className="text-sm text-muted-foreground">
                    Настройте поля, которые нужно заполнять при добавлении товаров в эту категорию
                  </p>
                  {showHint && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                      <p className="text-xs text-blue-900 dark:text-blue-200 font-medium mb-1">Подсказка:</p>
                      <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5 list-disc list-inside">
                        <li><strong>Основной вариант</strong> — для вкуса, цвета или модели (отображается внизу: "• Значение")</li>
                        <li><strong>Характеристика</strong> — для крепости, омов, мощности (отображается рядом с брендом)</li>
                        <li><strong>Дополнительное поле</strong> — для любой другой информации (сохраняется, но не отображается в посте)</li>
                      </ul>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={() => {
                    setEditingField(null);
                    setShowAddFieldForm(true);
                    setFieldFormData({
                      name: '',
                      label: '',
                      type: 'text',
                      required: false,
                      options: [],
                      optionsInput: '',
                      target: 'custom',
                    });
                  }}
                >
                  <Plus size={16} className="mr-2" />
                  Добавить поле
                </Button>
              </div>

              {/* Existing Fields List */}
              {(() => {
                const allFields = getAllFieldsForCategory(editingCategory);
                const configuredFieldIds = new Set((formData.customFields || []).map(f => f.id));
                
                if (allFields.length === 0) return null;

                return (
                  <div className="space-y-2">
                    {allFields.map((field) => {
                      const isConfigured = configuredFieldIds.has(field.id);
                      const isExisting = field.id.startsWith('existing-');
                      const isDefault = field.id.startsWith('default-');
                      
                      return (
                        <div
                          key={field.id}
                          className={`flex flex-col gap-3 p-3 border rounded-lg min-w-0 sm:flex-row sm:items-center ${
                            isConfigured 
                              ? 'bg-secondary/30' 
                              : isExisting 
                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' 
                                : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-medium break-words">{field.label}</span>
                              <span className="text-xs text-muted-foreground shrink-0">({field.name})</span>
                              {field.required && (
                                <span className="text-xs text-destructive">*</span>
                              )}
                              {!isConfigured && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                  {isExisting ? 'Используется' : 'Предлагается'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 break-words">
                              Тип: {field.type === 'text' ? 'Текст' : field.type === 'number' ? 'Число' : 'Выбор'}
                              {field.options && field.options.length > 0 && (
                                <span> • Варианты: {field.options.join(', ')}</span>
                              )}
                              {field.target && (
                                <span> • Назначение: {
                                  field.target === 'flavor_name' ? 'Основной вариант (Вкус/Цвет)' :
                                  field.target === 'strength_label' ? 'Характеристика (Крепость/Омы)' :
                                  'Дополнительное поле'
                                }</span>
                              )}
                            </div>
                            {!isConfigured && (
                              <p className="text-xs text-muted-foreground mt-1 italic break-words">
                                {isExisting 
                                  ? 'Это поле используется в существующих товарах. Настройте его, чтобы управлять отображением.'
                                  : 'Это стандартное поле для данной категории. Настройте его для использования.'}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0 justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (!isConfigured) {
                                  // Преобразуем ненастроенное поле в настроенное
                                  // Генерируем уникальный ID с проверкой на дубликаты
                                  const existingIds = new Set(formData.customFields.map(f => f.id));
                                  let newId: string;
                                  do {
                                    newId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                  } while (existingIds.has(newId));
                                  
                                  const newField: CategoryField = {
                                    ...field,
                                    id: newId,
                                  };
                                  setFormData({
                                    ...formData,
                                    customFields: [...formData.customFields, newField],
                                  });
                                  editField(newField);
                                } else {
                                  editField(field);
                                }
                              }}
                              className="h-8 w-8"
                              title={isConfigured ? 'Редактировать' : 'Настроить'}
                            >
                              <Edit2 size={14} />
                            </Button>
                            {isConfigured && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeField(field.id)}
                                className="h-8 w-8 text-destructive"
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Add/Edit Field Form */}
              {showAddFieldForm || editingField ? (
                <div className="border rounded-lg p-3 space-y-3 bg-secondary/20 min-w-0 sm:p-4">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <Label className="text-sm font-semibold min-w-0 break-words">
                      {editingField ? 'Редактировать поле' : 'Новое поле'}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setEditingField(null);
                        setShowAddFieldForm(false);
                        setFieldFormData({
                          name: '',
                          label: '',
                          type: 'text',
                          required: false,
                          options: [],
                          optionsInput: '',
                          target: 'custom',
                        });
                      }}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs">Название поля (ID)</Label>
                      <Input
                        value={fieldFormData.name}
                        onChange={(e) => setFieldFormData({ ...fieldFormData, name: e.target.value })}
                        placeholder="например: strength"
                        disabled={!!editingField}
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs">Метка (отображаемое название)</Label>
                      <Input
                        value={fieldFormData.label}
                        onChange={(e) => setFieldFormData({ ...fieldFormData, label: e.target.value })}
                        placeholder="например: Крепость"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-xs">Тип поля</Label>
                      <Select
                        value={fieldFormData.type}
                        onValueChange={(value: 'text' | 'number' | 'select') =>
                          setFieldFormData({ ...fieldFormData, type: value })
                        }
                      >
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Текст</SelectItem>
                          <SelectItem value="number">Число</SelectItem>
                          <SelectItem value="select">Выбор из списка</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 flex items-end">
                      <div className="flex items-center gap-2 w-full">
                        <Switch
                          checked={fieldFormData.required}
                          onCheckedChange={(checked) =>
                            setFieldFormData({ ...fieldFormData, required: checked })
                          }
                        />
                        <Label className="text-xs">Обязательное поле</Label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Назначение поля</Label>
                    <Select
                      value={fieldFormData.target}
                      onValueChange={(value: 'flavor_name' | 'strength_label' | 'custom') =>
                        setFieldFormData({ ...fieldFormData, target: value })
                      }
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Дополнительное поле</SelectItem>
                        <SelectItem value="flavor_name">Основной вариант (Вкус/Цвет)</SelectItem>
                        <SelectItem value="strength_label">Характеристика (Крепость/Омы)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1 break-words">
                      {fieldFormData.target === 'flavor_name' && 'Это поле будет отображаться в нижней строке товара (например: "• Клубника")'}
                      {fieldFormData.target === 'strength_label' && 'Это поле будет отображаться рядом с названием бренда (например: "Brand 20mg")'}
                      {fieldFormData.target === 'custom' && 'Это поле будет сохранено как дополнительная информация о товаре'}
                    </p>
                  </div>
                  {fieldFormData.type === 'select' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Варианты (через запятую)</Label>
                      <Input
                        value={fieldFormData.optionsInput}
                        onChange={(e) =>
                          setFieldFormData({ ...fieldFormData, optionsInput: e.target.value })
                        }
                        placeholder="например: 20 мг, 30 мг, 50 мг"
                      />
                    </div>
                  )}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {(editingField || showAddFieldForm) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setEditingField(null);
                          setShowAddFieldForm(false);
                          setFieldFormData({
                            name: '',
                            label: '',
                            type: 'text',
                            required: false,
                            options: [],
                            optionsInput: '',
                            target: 'custom',
                          });
                        }}
                      >
                        Отмена
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={editingField ? updateField : addField}
                      disabled={!fieldFormData.name.trim() || !fieldFormData.label.trim()}
                    >
                      {editingField ? 'Сохранить' : 'Добавить'}
                    </Button>
                  </div>
                </div>
              ) : formData.customFields.length === 0 ? (
                <div className="text-center py-6 text-sm border rounded-lg bg-muted/30">
                  <p className="text-muted-foreground mb-2">Нет настроенных полей</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Нажмите кнопку "Добавить поле" выше, чтобы создать первое поле для этой категории
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Например: для жидкостей можно добавить поля "Вкус" (Основной вариант) и "Крепость" (Характеристика)
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditingCategory(null)}>
              Отмена
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !formData.name.trim()}
            >
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent className="glass-card border-border max-w-[95vw] sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить категорию "{deletingCategory?.name}"?
              <br />
              <br />
              <strong>Внимание:</strong> Категорию можно удалить только если в ней нет брендов и товаров.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
