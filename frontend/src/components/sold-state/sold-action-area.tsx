"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { MessageSquare, ChevronDown, Loader2, X } from "lucide-react";

interface SoldActionAreaProps {
  buyerDisplayName: string;
  buyerId: string;
  /** End date passed → show "Manage" button. Otherwise → show "Cancel deal" */
  endDatePassed: boolean;
  onOpenManage: () => void;
  onCancelSale: () => Promise<void>;
}

export function SoldActionArea({
  buyerDisplayName,
  buyerId,
  endDatePassed,
  onOpenManage,
  onCancelSale,
}: SoldActionAreaProps) {
  const t = useTranslations("offers");
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleConfirmedCancel = async () => {
    setCancelLoading(true);
    try {
      await onCancelSale();
      setConfirmOpen(false);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-none gap-2 border-t border-ticker-line px-4 pb-[14px] pt-3">
        <button
          type="button"
          onClick={() => router.push(`/messages?to=${buyerId}`)}
          className="relative flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ticker-emer text-[14.5px] font-semibold text-[oklch(0.15_0_0)] transition-colors hover:opacity-90"
        >
          <MessageSquare className="size-4" />
          {t("openChatWith", { name: buyerDisplayName })}
        </button>

        {endDatePassed ? (
          <button
            type="button"
            onClick={onOpenManage}
            className="flex h-12 items-center gap-1 rounded-xl border border-ticker-line bg-transparent px-3.5 text-[13px] font-medium text-ticker-mid transition-colors hover:bg-ticker-bg-2 hover:text-ticker-text"
          >
            {t("manageSale")}
            <ChevronDown className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex h-12 items-center gap-1.5 rounded-xl border border-ticker-red/30 bg-transparent px-3.5 text-[13px] font-medium text-ticker-red transition-colors hover:bg-ticker-red/10"
          >
            <X className="size-3.5" />
            {t("cancelSale")}
          </button>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) setConfirmOpen(false); }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
            <DialogPrimitive.Popup className="dark fixed left-1/2 top-1/2 z-[61] w-[calc(100%-32px)] max-w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ticker-line bg-ticker-bg-3 p-5 shadow-2xl outline-none">
              <DialogPrimitive.Title className="m-0 text-[17px] font-semibold tracking-[-0.005em] text-ticker-text">
                {t("cancelSaleDialogTitle")}
              </DialogPrimitive.Title>
              <p className="mt-2 mb-5 text-[13px] leading-[1.5] text-ticker-mid">
                {t("cancelSaleDialogBody")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="flex h-[42px] flex-1 items-center justify-center rounded-[10px] border border-ticker-line bg-transparent text-[13.5px] font-medium text-ticker-text hover:bg-ticker-bg-2"
                >
                  {t("cancelSaleDialogCancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmedCancel}
                  disabled={cancelLoading}
                  className="flex h-[42px] flex-1 items-center justify-center rounded-[10px] bg-ticker-red text-[13.5px] font-semibold text-white disabled:opacity-50"
                >
                  {cancelLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    t("cancelSaleDialogConfirm")
                  )}
                </button>
              </div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </>
  );
}
