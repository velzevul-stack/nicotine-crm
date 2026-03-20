'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { ViewportScrollShell, viewportMainCentered } from '@/components/ViewportScrollShell';
import { cn } from '@/lib/utils';

export default function ClientPage() {
  return (
    <ViewportScrollShell
      maxWidth="md"
      mainClassName={cn(
        viewportMainCentered,
        'bg-gradient-to-br from-background via-background to-secondary/20'
      )}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Скоро</CardTitle>
          <CardDescription>
            Клиентская часть находится в разработке
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Функционал для клиентов будет доступен в ближайшее время.
            Следите за обновлениями!
          </p>
        </CardContent>
      </Card>
    </ViewportScrollShell>
  );
}
