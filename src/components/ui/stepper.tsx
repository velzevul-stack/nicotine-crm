'use client';

import { Minus, Plus } from 'lucide-react';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
}: StepperProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div className="inline-flex items-center gap-3 bg-muted rounded-[16px] p-2">
      <button
        onClick={handleDecrement}
        disabled={value <= min}
        className="p-2 rounded-lg hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={18} className="text-foreground" strokeWidth={2} />
      </button>
      <span className="text-foreground min-w-[3ch] text-center text-lg font-semibold">
        {value}
      </span>
      <button
        onClick={handleIncrement}
        disabled={value >= max}
        className="p-2 rounded-lg hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus size={18} className="text-foreground" strokeWidth={2} />
      </button>
    </div>
  );
}
