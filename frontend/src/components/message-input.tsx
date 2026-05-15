"use client";

import { useState, useRef } from "react";
import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const t = useTranslations("messages");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isOverLimit = text.length > 2000;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || isOverLimit) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="border-t border-border bg-background px-3 py-2">
      {isOverLimit && (
        <p className="text-xs text-destructive mb-1.5 px-1">{t("tooLong")}</p>
      )}
      <div className="flex gap-2 items-end">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={t("typeMessage")}
            disabled={disabled || sending}
            rows={1}
            style={{ scrollbarWidth: "none" }}
            className="block w-full resize-none rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm leading-5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          {text.length > 1800 && (
            <span className={cn(
              "absolute bottom-1 right-2 text-[10px]",
              isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
            )}>
              {text.length}/2000
            </span>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!hasText || disabled || sending || isOverLimit}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl transition-colors",
            "h-[38px] w-[38px]",
            hasText && !isOverLimit
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-muted text-muted-foreground"
          )}
          aria-label={t("send")}
        >
          <ArrowUp className="size-5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
