"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "cn";

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;

export function DialogPortal({ children, ...props }: React.ComponentProps<typeof BaseDialog.Portal>) {
  return (
    <BaseDialog.Portal {...props}>
      <BaseDialog.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-150",
          "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
        )}
      />
      {children}
    </BaseDialog.Portal>
  );
}

export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof BaseDialog.Popup> & { showClose?: boolean }) {
  return (
    <DialogPortal>
      <BaseDialog.Popup
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 text-card-foreground shadow-xl outline-none transition-all duration-150",
          "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <BaseDialog.Close
            className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={18} />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </DialogPortal>
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof BaseDialog.Title>) {
  return <BaseDialog.Title className={cn("text-base font-bold text-foreground", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof BaseDialog.Description>) {
  return <BaseDialog.Description className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />;
}
