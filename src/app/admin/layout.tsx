import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import Link from 'next/link';
import { Home, Users, FileText, Settings, Cog, Server } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/');
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    redirect('/');
  }

  const navItems = [
    { href: '/admin', label: 'Обзор', icon: Home },
    { href: '/admin/stats', label: 'Статистика бота', icon: Home },
    { href: '/admin/users', label: 'Пользователи', icon: Users },
    { href: '/admin/formats', label: 'Форматы постов', icon: FileText },
    { href: '/admin/suggestions', label: 'Предложения', icon: Settings },
    { href: '/admin/server', label: 'Сервер', icon: Server },
    { href: '/admin/settings', label: 'Настройки', icon: Cog },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-lg font-semibold">Админ-панель</h1>
              <div className="flex gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary transition-colors"
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Вернуться на сайт
            </Link>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
