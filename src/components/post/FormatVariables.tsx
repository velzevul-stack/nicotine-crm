'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function FormatVariables() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const copyTemplate = (template: string, name: string) => {
    navigator.clipboard.writeText(template);
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: 'Шаблон скопирован',
      description: `Шаблон "${name}" скопирован в буфер обмена`,
    });
  };

  const readyTemplates = [
    {
      name: 'Простой формат с приветствием',
      template: `🤔Если вы ищите где взять самый вкусный раскур🤔

💭ТОГДА ВЫ ПОПАЛИ ПРЯМО ПО АДРЕСУ!💭

🔔Приветствуем вас в нашем ШОПЕ🔔

{content}

🤫@raskurmanager🤫`,
    },
    {
      name: 'Формат с ценами без вкусов',
      template: `➡️ ТОВАРЫ УЖЕ В НАЛИЧИИ!

• При покупке пода вы получаете жидкость в подарок
• При заказе от 50р доставка до дома бесплатная

{loop:categories}
{category.emoji} {category.name}
{loop:formats}
👼 | {format.name} — {format.price}р
{/loop}
{/loop}

📱 Самовывоз: Центр, БРУ, Юбилейный
🤝 Доставка по городу — 5р`,
    },
    {
      name: 'Формат с остатками',
      template: `📦⚡️Доставка от 5 до 20 минут⚡️📦
❗️ТОЛЬКО НАЛИЧКА❗️

{loop:categories}
{category.emoji} {category.name.toUpperCase()} {category.emoji}

{loop:formats}
{format.name} ({format.price} BYN)
{if:hasFlavors}
{loop:flavors}
• {flavor.name} — остаток: {flavor.stock}
{/loop}
{/if}
{/loop}
{/loop}

🤫@raskurmanager🤫`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3 text-base">📋 Готовые шаблоны</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Выберите готовый шаблон и скопируйте его в редактор, затем адаптируйте под себя
        </p>
        <div className="space-y-3">
          {readyTemplates.map((tpl) => (
            <div
              key={tpl.name}
              className="glass-card rounded-lg p-4 border border-border"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm">{tpl.name}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyTemplate(tpl.template, tpl.name)}
                  className="h-7"
                >
                  {copied === tpl.name ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <Copy size={14} />
                  )}
                </Button>
              </div>
              <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {tpl.template}
              </pre>
            </div>
          ))}
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="variables">
          <AccordionTrigger>
            <h3 className="font-semibold">📝 Доступные переменные</h3>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm pt-2">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                    {'{content}'}
                  </code>
                  <span className="text-xs text-muted-foreground">Основная переменная</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Вставит весь контент: категории, бренды, форматы и вкусы в стандартном формате.
                  Используйте эту переменную, если хотите стандартное отображение всех товаров.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Пример использования: Просто вставьте {'{content}'} в шаблон, и система автоматически
                  сгенерирует список всех товаров с правильным форматированием.
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-2 text-xs">Переменные категорий (используются внутри цикла)</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{category.name}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Название категории</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{category.emoji}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Эмодзи категории</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-2 text-xs">Переменные брендов (используются внутри цикла)</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{brand.name}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Название бренда</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{brand.emojiPrefix}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Эмодзи префикс бренда</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-2 text-xs">Переменные форматов (используются внутри цикла)</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{format.name}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Название формата</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{format.price}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Цена в BYN</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{format.strength}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Крепость (если указана)</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-2 text-xs">Переменные вкусов (используются внутри цикла)</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{flavor.name}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Название вкуса</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{flavor.stock}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Остаток в наличии</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-2 text-xs">Переменные магазина</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{shop.name}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Название вашего магазина</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                      {'{shop.address}'}
                    </code>
                    <span className="text-xs text-muted-foreground">Адрес магазина</span>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="conditions">
          <AccordionTrigger>
            <h3 className="font-semibold">🔀 Условные блоки</h3>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm pt-2">
              <div className="p-3 bg-muted/50 rounded-lg">
                <code className="bg-background px-2 py-1 rounded font-mono text-xs block mb-2">
                  {'{if:hasFlavors}\n  Ваш текст здесь\n{/if}'}
                </code>
                <p className="text-muted-foreground text-xs">
                  Показывает блок только если у формата есть вкусы в наличии.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Пример: Используйте для показа дополнительной информации только для товаров с вкусами.
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <code className="bg-background px-2 py-1 rounded font-mono text-xs block mb-2">
                  {'{if:hasStock}\n  В наличии: {flavor.stock}\n{/if}'}
                </code>
                <p className="text-muted-foreground text-xs">
                  Показывает блок только если есть остаток товара.
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <code className="bg-background px-2 py-1 rounded font-mono text-xs block mb-2">
                  {'{if:!showFlavors}\n  Только форматы без вкусов\n{/if}'}
                </code>
                <p className="text-muted-foreground text-xs">
                  Показывает блок только если в настройках отключено отображение вкусов.
                  Символ ! означает отрицание условия.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="loops">
          <AccordionTrigger>
            <h3 className="font-semibold">🔄 Циклы</h3>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm pt-2">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-2 text-xs">Цикл по категориям</p>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`{loop:categories}
{category.emoji} {category.name}
  // здесь можно использовать переменные категории
{/loop}`}
                </pre>
                <p className="text-muted-foreground text-xs mt-2">
                  Перебирает все категории товаров. Внутри цикла доступны переменные category.*
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-2 text-xs">Цикл по брендам (внутри категории)</p>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`{loop:categories}
  {category.name}
  {loop:brands}
    {brand.name} {brand.emojiPrefix}
    // здесь доступны переменные brand.*
  {/loop}
{/loop}`}
                </pre>
                <p className="text-muted-foreground text-xs mt-2">
                  Перебирает все бренды внутри текущей категории. Должен быть внутри цикла категорий.
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-2 text-xs">Цикл по форматам (внутри бренда)</p>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`{loop:categories}
  {loop:brands}
    {loop:formats}
      👼 | {format.name} — {format.price}р
      // здесь доступны переменные format.*
    {/loop}
  {/loop}
{/loop}`}
                </pre>
                <p className="text-muted-foreground text-xs mt-2">
                  Перебирает все форматы внутри текущего бренда. Должен быть внутри цикла брендов.
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-2 text-xs">Цикл по вкусам (внутри формата)</p>
                <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`{loop:categories}
  {loop:brands}
    {loop:formats}
      {format.name}
      {loop:flavors}
        • {flavor.name}
        // здесь доступны переменные flavor.*
      {/loop}
    {/loop}
  {/loop}
{/loop}`}
                </pre>
                <p className="text-muted-foreground text-xs mt-2">
                  Перебирает все вкусы внутри текущего формата. Должен быть внутри цикла форматов.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm font-medium mb-2 text-blue-900 dark:text-blue-100">
          Как использовать переменные
        </p>
        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
          <li>Нажмите на кнопки над полем ввода, чтобы вставить переменные</li>
          <li>Или используйте готовые шаблоны выше — скопируйте и адаптируйте под себя</li>
          <li>Переменные в фигурных скобках автоматически заменятся на реальные данные</li>
          <li>Используйте циклы для перебора категорий, брендов, форматов и вкусов</li>
          <li>Используйте условия для показа блоков только при определенных условиях</li>
        </ol>
      </div>
    </div>
  );
}
