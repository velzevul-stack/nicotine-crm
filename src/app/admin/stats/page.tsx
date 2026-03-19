'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Activity, TrendingUp, BarChart3, ShoppingCart, FileText, DollarSign, Eye, Zap, Target, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { ru } from 'date-fns/locale';

interface UserStats {
  id: string;
  userId: string;
  firstUsedAt: string;
  lastUsedAt: string;
  daysUsed: number;
  totalSessions: number;
  lastSessionAt: string | null;
  inventoryViews: number;
  salesCreated: number;
  postsGenerated: number;
  debtsManaged: number;
  reportsViewed: number;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    role: string;
    subscriptionStatus: string;
  } | null;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

export default function AdminStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api<{ stats: UserStats[] }>('/api/admin/stats'),
  });

  if (isLoading) {
    return <div className="text-center py-8">Загрузка статистики...</div>;
  }

  const stats = data?.stats || [];

  // Активные пользователи (использовали за последние 7 дней)
  const sevenDaysAgo = subDays(new Date(), 7);
  const activeUsers = stats.filter((s) => {
    if (!s.lastUsedAt) return false;
    return new Date(s.lastUsedAt) >= sevenDaysAgo;
  }).length;

  // Очень активные пользователи (более 10 сессий)
  const veryActiveUsers = stats.filter((s) => s.totalSessions >= 10).length;

  // Пользователи с высокой вовлеченностью (используют 3+ функции)
  const engagedUsers = stats.filter((s) => {
    const functionsUsed = [
      s.inventoryViews > 0,
      s.salesCreated > 0,
      s.postsGenerated > 0,
      s.debtsManaged > 0,
      s.reportsViewed > 0,
    ].filter(Boolean).length;
    return functionsUsed >= 3;
  }).length;

  // Подготовка данных для графиков
  const usageByDays = stats
    .map((s) => ({
      name: s.user?.firstName || s.user?.telegramId || 'Неизвестно',
      days: s.daysUsed,
      sessions: s.totalSessions,
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 10);

  const functionUsage = stats.reduce(
    (acc, s) => ({
      inventoryViews: acc.inventoryViews + s.inventoryViews,
      salesCreated: acc.salesCreated + s.salesCreated,
      postsGenerated: acc.postsGenerated + s.postsGenerated,
      debtsManaged: acc.debtsManaged + s.debtsManaged,
      reportsViewed: acc.reportsViewed + s.reportsViewed,
    }),
    {
      inventoryViews: 0,
      salesCreated: 0,
      postsGenerated: 0,
      debtsManaged: 0,
      reportsViewed: 0,
    }
  );

  const functionUsageData = [
    { name: 'Просмотры склада', value: functionUsage.inventoryViews, icon: Eye },
    { name: 'Созданные продажи', value: functionUsage.salesCreated, icon: ShoppingCart },
    { name: 'Сгенерированные посты', value: functionUsage.postsGenerated, icon: FileText },
    { name: 'Управление долгами', value: functionUsage.debtsManaged, icon: DollarSign },
    { name: 'Просмотры отчётов', value: functionUsage.reportsViewed, icon: BarChart3 },
  ];

  // Топ активных пользователей (по общему количеству действий)
  const topActiveUsers = stats
    .map((s) => ({
      ...s,
      totalActions:
        s.inventoryViews +
        s.salesCreated +
        s.postsGenerated +
        s.debtsManaged +
        s.reportsViewed,
    }))
    .sort((a, b) => b.totalActions - a.totalActions)
    .slice(0, 10);

  // Статистика по подпискам
  const statsBySubscription = stats.reduce(
    (acc, s) => {
      const status = s.user?.subscriptionStatus || 'unknown';
      if (!acc[status]) {
        acc[status] = { count: 0, totalActions: 0, totalSessions: 0 };
      }
      acc[status].count += 1;
      acc[status].totalActions +=
        s.inventoryViews +
        s.salesCreated +
        s.postsGenerated +
        s.debtsManaged +
        s.reportsViewed;
      acc[status].totalSessions += s.totalSessions;
      return acc;
    },
    {} as Record<string, { count: number; totalActions: number; totalSessions: number }>
  );

  const subscriptionData = Object.entries(statsBySubscription).map(([key, value]) => ({
    name:
      key === 'active'
        ? 'Активные'
        : key === 'trial'
        ? 'Триал'
        : key === 'expired'
        ? 'Истекшие'
        : 'Неизвестно',
    value: value.count,
    actions: value.totalActions,
    sessions: value.totalSessions,
  }));

  const totalDaysUsed = stats.reduce((sum, s) => sum + s.daysUsed, 0);
  const totalSessions = stats.reduce((sum, s) => sum + s.totalSessions, 0);
  const totalActions =
    functionUsage.inventoryViews +
    functionUsage.salesCreated +
    functionUsage.postsGenerated +
    functionUsage.debtsManaged +
    functionUsage.reportsViewed;

  const avgDaysUsed = stats.length > 0 ? (totalDaysUsed / stats.length).toFixed(1) : 0;
  const avgSessions = stats.length > 0 ? (totalSessions / stats.length).toFixed(1) : 0;
  const avgActions = stats.length > 0 ? (totalActions / stats.length).toFixed(1) : 0;
  const engagementRate = stats.length > 0 ? ((engagedUsers / stats.length) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Статистика использования</h1>
        <p className="text-sm text-muted-foreground">
          Аналитика использования бота и его функций пользователями
        </p>
      </div>

      {/* Ключевые метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активных пользователей</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              За последние 7 дней из {stats.length} всего
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Вовлеченность</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Используют 3+ функции ({engagedUsers} пользователей)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Среднее действий</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgActions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              На пользователя (всего {totalActions})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Очень активных</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{veryActiveUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Более 10 сессий ({((veryActiveUsers / stats.length) * 100).toFixed(0)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Использование функций</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={functionUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Распределение по подпискам</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={subscriptionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {subscriptionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {subscriptionData.map((item) => (
                <div key={item.name} className="flex justify-between text-sm">
                  <span>{item.name}:</span>
                  <span className="font-medium">
                    {item.count} пользователей • {item.actions} действий • {item.sessions} сессий
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Топ пользователей */}
      <Card>
        <CardHeader>
          <CardTitle>Топ активных пользователей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Пользователь</th>
                  <th className="text-left p-2">Подписка</th>
                  <th className="text-left p-2">Дней</th>
                  <th className="text-left p-2">Сессий</th>
                  <th className="text-left p-2">Всего действий</th>
                  <th className="text-left p-2">Склад</th>
                  <th className="text-left p-2">Продажи</th>
                  <th className="text-left p-2">Посты</th>
                  <th className="text-left p-2">Долги</th>
                  <th className="text-left p-2">Отчёты</th>
                </tr>
              </thead>
              <tbody>
                {topActiveUsers.map((stat) => (
                  <tr key={stat.id} className="border-b">
                    <td className="p-2">
                      {stat.user?.firstName || stat.user?.telegramId || 'Неизвестно'}
                      {stat.user?.username && (
                        <span className="text-muted-foreground"> @{stat.user.username}</span>
                      )}
                    </td>
                    <td className="p-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          stat.user?.subscriptionStatus === 'active'
                            ? 'bg-green-100 text-green-800'
                            : stat.user?.subscriptionStatus === 'trial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {stat.user?.subscriptionStatus === 'active'
                          ? 'Активна'
                          : stat.user?.subscriptionStatus === 'trial'
                          ? 'Триал'
                          : 'Истекла'}
                      </span>
                    </td>
                    <td className="p-2 font-medium">{stat.daysUsed}</td>
                    <td className="p-2">{stat.totalSessions}</td>
                    <td className="p-2 font-bold text-primary">{stat.totalActions}</td>
                    <td className="p-2">{stat.inventoryViews}</td>
                    <td className="p-2">{stat.salesCreated}</td>
                    <td className="p-2">{stat.postsGenerated}</td>
                    <td className="p-2">{stat.debtsManaged}</td>
                    <td className="p-2">{stat.reportsViewed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topActiveUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Статистика пока отсутствует
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Детальная статистика */}
      <Card>
        <CardHeader>
          <CardTitle>Общая статистика</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{stats.length}</div>
              <div className="text-xs text-muted-foreground">Всего пользователей</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{avgDaysUsed}</div>
              <div className="text-xs text-muted-foreground">Среднее дней использования</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{avgSessions}</div>
              <div className="text-xs text-muted-foreground">Среднее сессий</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{totalActions}</div>
              <div className="text-xs text-muted-foreground">Всего действий</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
