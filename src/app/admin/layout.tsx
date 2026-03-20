import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import Link from 'next/link';
import { Home, Users, FileText, Settings, Cog, Server } from 'lucide-react';
import { ViewportScrollShell } from '@/components/ViewportScrollShell';

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
    <ViewportScrollShell
      maxWidth="full"
      header={
        <nav className="shrink-0 border-b bg-card">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto md:gap-8">
                <h1 className="shrink-0 text-lg font-semibold">Админ-панель</h1>
                <div className="flex gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors"
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
                className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
              >
                Вернуться на сайт
              </Link>
            </div>
          </div>
        </nav>
      }
      mainClassName="container mx-auto px-4 py-8"
    >
      {children}
    </ViewportScrollShell>
  );
}
