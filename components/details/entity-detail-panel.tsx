'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EntityDetailPanel({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const controls = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <dialog
      open
      ref={panelRef}
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="absolute inset-0 z-30 m-0 flex h-full w-full max-h-none max-w-none flex-col border-0 bg-card p-0 shadow-[-8px_0_24px_rgb(0_0_0/0.12)] outline-none motion-safe:animate-in motion-safe:slide-in-from-right-4 motion-safe:duration-200"
      data-entity-detail-panel
    >
      <header className="border-b border-border px-5 pb-4 pt-4">
        <div className="ui-text mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.08em] text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5"
            onClick={onClose}
            aria-label="Back to country briefing"
          >
            <ArrowLeft /> Back
          </Button>
          <span>{eyebrow}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close party details"
          >
            <X />
          </Button>
        </div>
        <h2 id={titleId} className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
    </dialog>
  );
}
