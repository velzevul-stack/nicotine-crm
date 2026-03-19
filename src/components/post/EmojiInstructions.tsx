'use client';

import { AlertCircle, Sparkles, Bot } from 'lucide-react';

export function EmojiInstructions() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-start gap-3">
          <Sparkles className="text-purple-600 dark:text-purple-400 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold mb-1 text-purple-900 dark:text-purple-100">
              Telegram Premium эмодзи
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-200">
              Telegram Premium эмодзи — это специальные анимированные эмодзи, доступные только для подписчиков Telegram Premium.
              Они делают ваши посты более привлекательными и выделяют их среди конкурентов!
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3 text-base">📱 Способ 1: Через мобильное приложение Telegram</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Откройте Telegram на мобильном устройстве</p>
              <p className="text-muted-foreground text-xs">
                Telegram Premium эмодзи доступны только в мобильном приложении Telegram (iOS или Android).
                Убедитесь, что у вас установлена последняя версия приложения и активна подписка Telegram Premium.
              </p>
              <div className="mt-2 p-2 bg-background rounded text-xs">
                <span className="font-medium">Проверка подписки:</span> Откройте настройки Telegram → 
                Если видите значок ⭐ рядом с вашим именем, значит Premium активна.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
              2
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Откройте любой чат и нажмите на поле ввода</p>
              <p className="text-muted-foreground text-xs">
                Это может быть личный чат, группа или канал. Главное — чтобы открылась клавиатура для ввода текста.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
              3
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Откройте клавиатуру эмодзи</p>
              <p className="text-muted-foreground text-xs">
                Нажмите на иконку эмодзи (😊) на клавиатуре. Обычно она находится в нижней части экрана рядом с кнопкой отправки.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
              4
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Найдите вкладку "Premium" или "⭐ Premium"</p>
              <p className="text-muted-foreground text-xs">
                Прокрутите вкладки эмодзи влево или вправо, чтобы найти вкладку Premium. 
                Она обычно помечена звездочкой ⭐ или надписью "Premium".
              </p>
              <div className="mt-2 p-2 bg-background rounded text-xs">
                <span className="font-medium">Важно:</span> Если вы не видите вкладку Premium, проверьте:
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Активна ли подписка Telegram Premium</li>
                  <li>Обновлено ли приложение до последней версии</li>
                  <li>Доступна ли функция в вашем регионе</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
              5
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Выберите и скопируйте эмодзи</p>
              <p className="text-muted-foreground text-xs">
                Нажмите на нужный Premium эмодзи. Он появится в поле ввода. 
                Затем выделите его и скопируйте (долгим нажатием → "Копировать").
              </p>
              <div className="mt-2 p-2 bg-background rounded text-xs">
                <span className="font-medium">Совет:</span> Можно скопировать несколько эмодзи подряд, 
                выделив их все вместе.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
              6
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Вставьте эмодзи в шаблон формата</p>
              <p className="text-muted-foreground text-xs">
                Вернитесь в редактор формата на сайте, установите курсор в нужное место шаблона 
                и вставьте скопированный эмодзи (Ctrl+V или долгое нажатие → "Вставить").
              </p>
              <div className="mt-2 p-2 bg-background rounded text-xs">
                <span className="font-medium">Проверка:</span> После вставки эмодзи должен отображаться в поле ввода. 
                Если вы видите квадратики или непонятные символы, попробуйте скопировать еще раз.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-start gap-3">
          <Bot className="text-green-600 dark:text-green-400 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium mb-2 text-green-900 dark:text-green-100">
              🤖 Способ 2: Через Telegram бота (РЕКОМЕНДУЕТСЯ!)
            </p>
            <p className="text-sm text-green-800 dark:text-green-200 mb-3">
              Самый простой способ — создать формат прямо в Telegram боте. 
              В боте Premium эмодзи доступны напрямую из клавиатуры, без необходимости копирования!
            </p>
            <div className="space-y-2">
              <div className="p-2 bg-background rounded text-xs">
                <span className="font-medium">Шаг 1:</span> Откройте бота в Telegram
              </div>
              <div className="p-2 bg-background rounded text-xs">
                <span className="font-medium">Шаг 2:</span> Отправьте команду{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded">/createformat</code>
              </div>
              <div className="p-2 bg-background rounded text-xs">
                <span className="font-medium">Шаг 3:</span> Следуйте инструкциям бота. 
                При вводе шаблона просто нажмите на иконку эмодзи и выберите Premium эмодзи — 
                они вставятся автоматически!
              </div>
              <div className="p-2 bg-background rounded text-xs">
                <span className="font-medium">Шаг 4:</span> После создания формата в боте, 
                вы можете импортировать его на сайт через кнопку "Импортировать из бота" 
                на странице форматов.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium mb-2 text-amber-900 dark:text-amber-100">
              ⚠️ Важная информация
            </p>
            <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
              <p>
                <span className="font-medium">Как это работает:</span> Telegram Premium эмодзи — это специальные Unicode символы. 
                Они сохраняются в шаблоне как обычный текст и будут корректно отображаться в постах.
              </p>
              <p>
                <span className="font-medium">Совместимость:</span> Эмодзи будут отображаться правильно у получателей, 
                если их устройство поддерживает эти символы. Большинство современных устройств поддерживают Premium эмодзи.
              </p>
              <p>
                <span className="font-medium">Если не работает:</span> Если у получателя эмодзи отображаются как квадратики 
                или непонятные символы, это означает, что его устройство или приложение не поддерживает эти эмодзи. 
                В этом случае можно использовать обычные эмодзи вместо Premium.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
        <p className="text-sm font-medium mb-2 text-purple-900 dark:text-purple-100">
          💎 Примеры использования Premium эмодзи
        </p>
        <div className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
          <p>
            Premium эмодзи отлично подходят для:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Выделения важных разделов поста</li>
            <li>Создания привлекательных заголовков</li>
            <li>Украшения списков товаров</li>
            <li>Добавления акцентов к ценам и акциям</li>
            <li>Создания уникального стиля ваших постов</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
