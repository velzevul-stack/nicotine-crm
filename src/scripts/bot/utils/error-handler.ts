import { Context } from 'telegraf';

/**
 * Глобальный обработчик ошибок для бота
 */
export function setupErrorHandler(bot: any) {
  bot.catch((err: any, ctx: Context) => {
    console.error(`❌ Ошибка для пользователя ${ctx.from?.id}:`, err);
    console.error(`   Сообщение: ${err.message || err.toString()}`);
    console.error(`   Stack: ${err.stack || 'нет'}`);
    console.error(`   Update:`, JSON.stringify(ctx.update, null, 2));
    
    // Отправляем пользователю понятное сообщение
    ctx.reply('❌ Что-то пошло не так. Попробуйте позже или обратитесь в поддержку.')
      .catch((sendError: any) => {
        console.error('Не удалось отправить сообщение об ошибке:', sendError);
      });

    // Отправляем админу детальный лог (если настроен)
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    if (adminId) {
      bot.telegram.sendMessage(
        parseInt(adminId),
        `🚨 Ошибка в боте:\n\n` +
        `Пользователь: ${ctx.from?.id} (@${ctx.from?.username || 'без username'})\n` +
        `Ошибка: ${err.message || err.toString()}\n` +
        `Stack: ${err.stack || 'нет'}`
      ).catch((adminError: any) => {
        console.error('Не удалось отправить сообщение админу:', adminError);
      });
    }

    // Специальная обработка ошибок БД
    if (err.code === '28P01') {
      console.error('\n💡 Ошибка аутентификации PostgreSQL!');
      console.error('   Проверьте правильность пароля в файле .env');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('\n💡 Не удалось подключиться к PostgreSQL!');
      console.error('   Убедитесь, что PostgreSQL запущен и доступен.');
    }
  });
}
