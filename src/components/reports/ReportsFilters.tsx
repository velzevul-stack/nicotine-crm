'use client';

import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';

interface ReportsFiltersProps {
  periodType: 'month' | 'week' | 'year' | 'custom' | 'all';
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  calculatedDateRange: { from: Date; to: Date };
  onPeriodTypeChange: (type: 'month' | 'week' | 'year' | 'custom' | 'all') => void;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
}

export function ReportsFilters({
  periodType,
  dateFrom,
  dateTo,
  calculatedDateRange,
  onPeriodTypeChange,
  onDateFromChange,
  onDateToChange,
}: ReportsFiltersProps) {
  return (
    <div className="px-4 mb-4">
      <div className="glass-card rounded-xl p-3 space-y-3">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
          Период отчёта
        </label>
        
        {/* Period type selector */}
        <div className="grid grid-cols-5 gap-2">
          {(['all', 'week', 'month', 'year', 'custom'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                onPeriodTypeChange(type);
                if (type !== 'custom') {
                  onDateFromChange(undefined);
                  onDateToChange(undefined);
                }
              }}
              className={`h-9 px-1 min-w-0 rounded-lg text-xs font-medium transition-colors truncate ${
                periodType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
              title={type === 'custom' ? 'Произвольный период' : undefined}
            >
              {type === 'month' ? 'Месяц' : 
               type === 'week' ? 'Неделя' : 
               type === 'year' ? 'Год' : 
               type === 'all' ? 'Всё' : 
               'Свой'}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {periodType === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">От</label>
              <DatePicker
                date={dateFrom}
                setDate={onDateFromChange}
                placeholder="Выберите дату"
                disabled={(date) => (dateTo ? date > dateTo : date > new Date())}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">До</label>
              <DatePicker
                date={dateTo}
                setDate={onDateToChange}
                placeholder="Выберите дату"
                disabled={(date) => (dateFrom ? date < dateFrom : false) || date > new Date()}
              />
            </div>
          </div>
        )}

        {/* Period info */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            Период: {format(calculatedDateRange.from, 'dd.MM.yyyy', { locale: ru })} - {format(calculatedDateRange.to, 'dd.MM.yyyy', { locale: ru })}
          </span>
        </div>
      </div>
    </div>
  );
}
