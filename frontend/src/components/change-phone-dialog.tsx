"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePhone } from "@/lib/auth";
import { Loader2, X } from "lucide-react";

interface ChangePhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhone: string | null;
  onChanged: (phone: string, verified: boolean) => void;
}

export function ChangePhoneDialog({
  open,
  onOpenChange,
  initialPhone,
  onChanged,
}: ChangePhoneDialogProps) {
  const t = useTranslations("phoneManagement");

  const [newPhone, setNewPhone] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setNewPhone(initialPhone ?? "");
      setPassword("");
      setError("");
    }
  }, [open, initialPhone]);

  async function handleSubmit() {
    setError("");
    const trimmed = newPhone.trim();
    if (!trimmed) {
      setError(t("errorPhoneRequired"));
      return;
    }
    if (!password) {
      setError(t("errorPasswordRequired"));
      return;
    }

    setSaving(true);
    try {
      const result = await changePhone(trimmed, password);
      onChanged(result.phone, result.phoneVerified);
      onOpenChange(false);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message === "INVALID_PASSWORD") {
        setError(t("errorInvalidPassword"));
      } else if (e.message === "SAME_PHONE") {
        setError(t("errorSamePhone"));
      } else if (e.message === "PHONE_CHANGE_TOO_SOON") {
        setError(t("errorChangeTooSoon"));
      } else {
        setError(t("errorGeneric"));
      }
    } finally {
      setSaving(false);
    }
  }

  const isAdding = !initialPhone;

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isAdding ? t("addPhone") : t("changePhone")}</DialogTitle>
          <DialogDescription>
            {isAdding ? t("addPhoneDescription") : t("changePhoneDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving) handleSubmit();
          }}
          className="contents"
        >
          <div className="space-y-3">
            <div>
              <Label htmlFor="change-phone-new" className="text-xs font-medium">
                {t("newPhoneLabel")}
              </Label>
              <Input
                id="change-phone-new"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder={t("newPhonePlaceholder")}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="change-phone-password" className="text-xs font-medium">
                {t("passwordLabel")}
              </Label>
              <Input
                id="change-phone-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                className="mt-1"
              />
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              <X className="size-3.5 mr-1" />
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
