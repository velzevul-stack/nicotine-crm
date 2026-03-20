import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canAccess } from '@/lib/auth-utils';
import { AppLayout } from '@/components/AppLayout';
import { ViewportScrollShell, viewportMainCentered } from '@/components/ViewportScrollShell';
import { getDataSource } from '@/lib/db/data-source';
import { SystemSettingsEntity, UserEntity } from '@/lib/db/entities';

const MAINTENANCE_KEY = 'maintenance_mode';

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/');
  }

  // Объединяем все запросы к БД в одну транзакцию для предотвращения параллельных запросов
  const ds = await getDataSource();
  const result = await ds.transaction(async (em) => {
    // Проверка подписки пользователя
    const userRepo = em.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { id: session.userId } });
    if (!user) return { userWithSub: null, maintenanceEnabled: false, maintenanceMessage: null };

    const now = new Date();
    const isTrialExpired = user.trialEndsAt ? new Date(user.trialEndsAt) < now : false;
    
    let hasActiveSubscription = false;
    
    if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt) {
      hasActiveSubscription = new Date(user.subscriptionEndsAt) > now;
    } else if (user.subscriptionStatus === 'trial' && user.trialEndsAt) {
      hasActiveSubscription = new Date(user.trialEndsAt) > now;
    }

    const userWithSub = {
      ...user,
      hasActiveSubscription,
      isTrialExpired,
    };

    // Проверка режима обслуживания (только для не-админов)
    let maintenanceEnabled = false;
    let maintenanceMessage: string | null = null;
    
    if (userWithSub.role !== 'admin') {
      const settingsRepo = em.getRepository(SystemSettingsEntity);
      const maintenanceSetting = await settingsRepo.findOne({
        where: { key: MAINTENANCE_KEY },
      });

      if (maintenanceSetting) {
        const value = JSON.parse(maintenanceSetting.value);
        if (value.enabled) {
          maintenanceEnabled = true;
          maintenanceMessage = value.message || null;
        }
      }
    }

    return { userWithSub, maintenanceEnabled, maintenanceMessage };
  });

  if (!result.userWithSub || !canAccess(result.userWithSub)) {
    redirect('/subscription-expired');
  }

  // Проверка режима обслуживания
  if (result.maintenanceEnabled) {
    return (
      <ViewportScrollShell maxWidth="md" mainClassName={viewportMainCentered}>
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">
            Техническое обслуживание
          </h1>
          <p className="text-muted-foreground">
            {result.maintenanceMessage || 'Система находится на техническом обслуживании. Пожалуйста, попробуйте позже.'}
          </p>
        </div>
      </ViewportScrollShell>
    );
  }

  // Редирект клиентов на их страницу
  if (result.userWithSub.role === 'client') {
    redirect('/client');
  }

  return <AppLayout>{children}</AppLayout>;
}
