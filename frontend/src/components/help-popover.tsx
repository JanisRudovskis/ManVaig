"use client";

import { useTranslations } from "next-intl";
import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";

interface HelpPopoverProps {
  helpKey: string;
}

export function HelpPopover({ helpKey }: HelpPopoverProps) {
  const t = useTranslations("help");

  const hasGood = t.has(`${helpKey}.good`);
  const hasBad = t.has(`${helpKey}.bad`);
  const hasGoodLabel = t.has(`${helpKey}.goodLabel`);
  const hasBadLabel = t.has(`${helpKey}.badLabel`);

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t(`${helpKey}.title`)}
        onClick={(e) => e.preventDefault()}
      >
        <HelpCircle className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-72 !z-[60]"
      >
        <PopoverHeader>
          <PopoverTitle>{t(`${helpKey}.title`)}</PopoverTitle>
          <PopoverDescription>{t(`${helpKey}.body`)}</PopoverDescription>
        </PopoverHeader>

        {hasGood && (
          <div className="text-xs">
            {hasGoodLabel && (
              <p className="font-medium text-emerald-400">{t(`${helpKey}.goodLabel`)}</p>
            )}
            <p className="text-muted-foreground">{t(`${helpKey}.good`)}</p>
          </div>
        )}
        {hasBad && (
          <div className="text-xs mt-1.5">
            {hasBadLabel && (
              <p className="font-medium text-destructive">{t(`${helpKey}.badLabel`)}</p>
            )}
            <p className="text-muted-foreground">{t(`${helpKey}.bad`)}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
