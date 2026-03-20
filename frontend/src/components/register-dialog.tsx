"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RegisterFormContent } from "@/components/register-form";
import type { AuthResponse } from "@/lib/auth";

interface RegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (data: AuthResponse) => void;
}

export function RegisterDialog({ open, onOpenChange, onSuccess }: RegisterDialogProps) {
  function handleSuccess(data: AuthResponse) {
    onOpenChange(false);
    onSuccess?.(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton>
        <RegisterFormContent onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
