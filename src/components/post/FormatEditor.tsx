'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Sparkles } from 'lucide-react';
import { FormatPreview } from './FormatPreview';
import { FormatVariables } from './FormatVariables';
import { EmojiInstructions } from './EmojiInstructions';
import { VariableInsertButtons } from './VariableInsertButtons';

interface PostFormat {
  id: string;
  name: string;
  template: string;
  config: any;
}

interface FormatEditorProps {
  format?: PostFormat;
  onSave: () => void;
  onCancel: () => void;
}

export function FormatEditor({ format, onSave, onCancel }: FormatEditorProps) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState(format?.name || '');
  const [template, setTemplate] = useState(
    format?.template ||
      `📦⚡️Доставка от 5 до 20 минут⚡️📦
❗️ТОЛЬКО НАЛИЧКА❗️

{content}`
  );
  const [config, setConfig] = useState({
    showFlavors: format?.config?.showFlavors !== false,
    showPrices: format?.config?.showPrices !== false,
    showStock: format?.config?.showStock === true,
    showCategories: format?.config?.showCategories !== false,
  });

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = template;
    const before = text.substring(0, start);
    const after = text.substring(end);

    setTemplate(before + variable + after);

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variable.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api('/api/inventory'),
  });

  const saveMutation = useMutation({
    mutationFn: (data: {
      name: string;
      template: string;
      config: any;
    }) => {
      if (format) {
        return api(`/api/post/formats/${format.id}`, {
          method: 'PATCH',
          body: data,
        });
      } else {
        return api('/api/post/formats', {
          method: 'POST',
          body: data,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: 'Формат сохранен',
        description: format ? 'Формат обновлен' : 'Формат создан',
      });
      onSave();
    },
    onError: () => {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить формат',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название формата',
        variant: 'destructive',
      });
      return;
    }

    if (!template.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите шаблон формата',
        variant: 'destructive',
      });
      return;
    }

    saveMutation.mutate({
      name: name.trim(),
      template: template.trim(),
      config,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Название формата</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Формат с ценами"
        />
      </div>

      <Tabs defaultValue="editor" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="editor">Редактор</TabsTrigger>
          <TabsTrigger value="preview">Превью</TabsTrigger>
          <TabsTrigger value="help">Справка</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Шаблон формата</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                <Sparkles size={14} className="text-primary" />
                <span>Используйте кнопки для вставки переменных</span>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                <span className="font-medium">Как использовать:</span> Установите курсор в нужное место шаблона, 
                затем нажмите на кнопку с нужной переменной — она автоматически вставится в это место.
              </p>
            </div>

            <VariableInsertButtons onInsert={insertVariable} />
            
            <Textarea
              ref={textareaRef}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder={`Пример шаблона:

🤔Если вы ищите где взять самый вкусный раскур🤔

💭ТОГДА ВЫ ПОПАЛИ ПРЯМО ПО АДРЕСУ!💭

{content}

🤫@raskurmanager🤫`}
              rows={18}
              className="font-mono text-sm"
            />
            
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
              <span className="font-medium">Совет:</span>
              <span>
                Не нужно вручную вводить фигурные скобки! Просто кликните на нужную переменную выше, 
                и она вставится автоматически. Также можете использовать готовые шаблоны во вкладке "Справка".
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Настройки отображения</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showFlavors"
                  checked={config.showFlavors}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, showFlavors: !!checked })
                  }
                />
                <Label htmlFor="showFlavors" className="cursor-pointer">
                  Показывать вкусы
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showPrices"
                  checked={config.showPrices}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, showPrices: !!checked })
                  }
                />
                <Label htmlFor="showPrices" className="cursor-pointer">
                  Показывать цены
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showStock"
                  checked={config.showStock}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, showStock: !!checked })
                  }
                />
                <Label htmlFor="showStock" className="cursor-pointer">
                  Показывать остатки
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showCategories"
                  checked={config.showCategories}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, showCategories: !!checked })
                  }
                />
                <Label htmlFor="showCategories" className="cursor-pointer">
                  Показывать категории
                </Label>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <FormatPreview
            template={template}
            config={config}
            inventoryData={inventoryData}
          />
        </TabsContent>

        <TabsContent value="help" className="space-y-4">
          <FormatVariables />
          <EmojiInstructions />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </div>
  );
}
