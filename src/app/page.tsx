import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { checkUserSubscription, canAccess } from '@/lib/auth-utils';
import { LoginForm } from '@/components/LoginForm';

export default async function HomePage() {
  const session = await getSession();
  
  // Если есть сессия, проверяем подписку
  if (session) {
    const userWithSub = await checkUserSubscription(session.userId);
    
    if (userWithSub && canAccess(userWithSub)) {
      // Подписка активна - редиректим в приложение
      if (userWithSub.role === 'client') {
        redirect('/client');
      } else {
        // Для seller редиректим на dashboard
        redirect('/dashboard');
      }
    } else if (userWithSub && !canAccess(userWithSub)) {
      // Подписка истекла - редиректим на страницу истечения подписки
      redirect('/subscription-expired');
    }
  }
  
  // Если нет сессии или проблемы с подпиской - показываем форму логина
  return <LoginForm />;
}
