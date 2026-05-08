"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Phone,
  CheckCircle,
  AlertCircle,
  ArrowRightLeft,
} from "lucide-react";
import { ChangePhoneDialog } from "@/components/change-phone-dialog";

interface PhoneManagementProps {
  phone: string | null;
  phoneVerified: boolean;
  editing: boolean;
  onPhoneChanged?: (phone: string, verified: boolean) => void;
}

export function PhoneManagement({
  phone,
  phoneVerified,
  editing,
  onPhoneChanged,
}: PhoneManagementProps) {
  const t = useTranslations("phoneManagement");

  const [currentPhone, setCurrentPhone] = useState(phone);
  const [currentVerified, setCurrentVerified] = useState(phoneVerified);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setCurrentPhone(phone);
    setCurrentVerified(phoneVerified);
  }, [phone, phoneVerified]);

  function handleChanged(newPhone: string, verified: boolean) {
    setCurrentPhone(newPhone);
    setCurrentVerified(verified);
    onPhoneChanged?.(newPhone, verified);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 min-w-0">
          <Phone className="size-4 flex-shrink-0" />
          {currentPhone ? (
            <span className="truncate">{currentPhone}</span>
          ) : (
            <span>{t("notSet")}</span>
          )}
        </div>
        {currentPhone && (
          currentVerified ? (
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-xs whitespace-nowrap">
              <CheckCircle className="size-3.5" />
              {t("verified")}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 text-xs whitespace-nowrap">
              <AlertCircle className="size-3.5" />
              {t("notVerified")}
            </span>
          )
        )}
        {editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="h-8 text-xs px-2 ml-auto flex-shrink-0"
          >
            <ArrowRightLeft className="size-3 mr-1" />
            {currentPhone ? t("changePhone") : t("addPhone")}
          </Button>
        )}
      </div>

      <ChangePhoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialPhone={currentPhone}
        onChanged={handleChanged}
      />
    </div>
  );
}
