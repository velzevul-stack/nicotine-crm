import { getDataSource } from '@/lib/db/data-source';
import { UserEntity } from '@/lib/db/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function AdminDashboard() {
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    activeSubs,
    trialUsers,
    newUsersToday,
  ] = await Promise.all([
    userRepo.count(),
    userRepo.count({
      where: { subscriptionStatus: 'active' },
    }),
    userRepo.count({
      where: { subscriptionStatus: 'trial' },
    }),
    userRepo
      .createQueryBuilder('user')
      .where('user.createdAt >= :todayStart', { todayStart })
      .getCount(),
  ]);

  const stats = [
    {
      title: 'Всего пользователей',
      value: totalUsers,
      icon: Users,
      description: 'Зарегистрировано в системе',
    },
    {
      title: 'Активных подписок',
      value: activeSubs,
      icon: UserCheck,
      description: 'С активной платной подпиской',
    },
    {
      title: 'На триале',
      value: trialUsers,
      icon: Clock,
      description: 'Пробный период',
    },
    {
      title: 'Новых сегодня',
      value: newUsersToday,
      icon: TrendingUp,
      description: 'Зарегистрировались сегодня',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Панель управления</h1>
        <Link href="/admin/stats">
          <Button variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            Статистика использования бота
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
