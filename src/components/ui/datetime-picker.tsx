'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DateTimePicker({ value, onChange, placeholder = 'Выберите дату и время' }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(value ? value.split('T')[0] : '');
  const [time, setTime] = useState(value ? value.split('T')[1]?.slice(0, 5) : '');

  const handleSave = () => {
    if (date && time) {
      // Create ISO datetime string with timezone
      const dateTime = new Date(`${date}T${time}:00`);
      onChange(dateTime.toISOString());
      setOpen(false);
    }
  };

  const handleClear = () => {
    setDate('');
    setTime('');
    onChange('');
    setOpen(false);
  };

  const displayValue = value
    ? format(new Date(value), 'dd.MM.yyyy HH:mm', { locale: ru })
    : placeholder;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 flex items-center gap-2 text-left"
      >
        <Calendar size={16} className="text-muted-foreground shrink-0" />
        <span className={value ? '' : 'text-muted-foreground'}>{displayValue}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Выберите дату и время</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Дата</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Время</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClear} className="flex-1">
                Очистить
              </Button>
              <Button onClick={handleSave} disabled={!date || !time} className="flex-1 gradient-primary text-primary-foreground">
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
