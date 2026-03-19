'use client';

import { LucideIcon } from 'lucide-react';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Вариант приветствия: "Привет, {name}" + subtitle как "С возвращением!" */
  greeting?: string;
}

export function ScreenHeader({ title, subtitle, actions, greeting }: ScreenHeaderProps) {
  return (
    <header className="pt-8 pb-6 px-5">
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-foreground mb-1 font-bold leading-tight"
            style={{ fontSize: greeting ? '1.5rem' : '1.75rem', letterSpacing: '-0.02em' }}
          >
            {greeting ?? title}
          </h1>
          {(subtitle || (greeting && title)) && (
            <p
              className="text-muted-foreground"
              style={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.01em' }}
            >
              {greeting ? title : subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </header>
  );
}

interface IconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  label: string;
}

export function IconButton({ icon: Icon, onClick, label }: IconButtonProps) {
  return (
    <button
      className="p-2.5 hover:bg-muted rounded-full transition-colors"
      onClick={onClick}
      aria-label={label}
    >
      <Icon size={22} className="text-muted-foreground" strokeWidth={1.5} />
    </button>
  );
}
