"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LoginFormContent } from "@/components/login-form";
import type { AuthResponse } from "@/lib/auth";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (data: AuthResponse) => void;
}

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  function handleSuccess(data: AuthResponse) {
    onOpenChange(false);
    onSuccess?.(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton>
        <LoginFormContent onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
