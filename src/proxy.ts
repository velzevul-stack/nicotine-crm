import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Proxy для Next.js 16
 * Объединяет проверку сессий и режима обслуживания
 * 
 * Примечание: Проверка режима обслуживания через БД выполняется в API endpoints
 * и layout компонентах. Здесь используется только переменная окружения для
 * быстрого включения режима обслуживания без доступа к БД.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Пропускаем админские API endpoints (они сами проверяют режим обслуживания через БД)
  if (pathname.startsWith('/api/admin/')) {
    return NextResponse.next();
  }

  // Публичные маршруты (без проверки сессии)
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/telegram') ||
    pathname === '/login' ||
    pathname === '/' ||
    pathname === '/subscription-expired' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  // Проверка режима обслуживания через переменную окружения
  // (для детальной проверки через БД см. API endpoints и layout компоненты)
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
  if (maintenanceMode && !pathname.startsWith('/api/')) {
    // Проверяем наличие сессии - админы с активной сессией могут обойти режим обслуживания
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    // Если нет сессии, блокируем доступ
    if (!sessionCookie) {
      return NextResponse.json(
        {
          error: 'Service Unavailable',
          message: process.env.MAINTENANCE_MESSAGE || 'Система находится на техническом обслуживании. Пожалуйста, попробуйте позже.',
        },
        { status: 503 }
      );
    }
    // Если есть сессия, пропускаем (детальная проверка роли админа будет в layout)
  }

  // Проверка сессии (только проверка наличия cookie, без доступа к БД)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  
  if (!sessionCookie) {
    // API-запросы не редиректим — пусть endpoint сам вернёт 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }
    // Редирект на главную страницу (где форма логина), если нет сессии
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/?redirect=/admin', request.url));
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Детальные проверки ролей и подписки выполняются в layout компонентах
  // которые работают в Node.js runtime и имеют доступ к БД
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
