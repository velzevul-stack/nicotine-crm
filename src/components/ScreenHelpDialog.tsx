'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ScreenHelpDefinition } from '@/lib/screen-help-content';

type ScreenHelpDialogProps = {
  /** Переопределение заголовка диалога (по умолчанию — из `help.dialogTitle`) */
  title?: string;
  help: ScreenHelpDefinition;
};

export function ScreenHelpDialog({ title, help }: ScreenHelpDialogProps) {
  const [open, setOpen] = useState(false);
  const dialogTitle = title ?? help.dialogTitle;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        aria-label="Справка по экрану"
        onClick={() => setOpen(true)}
      >
        <HelpCircle size={22} strokeWidth={1.5} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed">
            {help.lead ? (
              <p className="text-muted-foreground">{help.lead}</p>
            ) : null}
            <ul className="list-disc space-y-2 pl-4 text-muted-foreground marker:text-muted-foreground/80">
              {help.bullets.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            {help.scenarios && help.scenarios.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Перейти к сценарию
                </p>
                <div className="flex flex-col gap-2">
                  {help.scenarios.map((s) => (
                    <Button
                      key={s.href + s.label}
                      type="button"
                      variant="secondary"
                      className="h-auto min-h-10 w-full justify-start whitespace-normal rounded-[12px] px-3 py-2 text-left font-normal"
                      asChild
                    >
                      <Link href={s.href} onClick={() => setOpen(false)}>
                        {s.label}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
