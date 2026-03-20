"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/user-avatar";
import { uploadAvatar } from "@/lib/auth";
import { Loader2, Camera } from "lucide-react";

interface AvatarUploadProps {
  displayName: string;
  avatarUrl: string | null;
  onUploaded: (url: string) => void;
}

export function AvatarUpload({
  displayName,
  avatarUrl,
  onUploaded,
}: AvatarUploadProps) {
  const t = useTranslations("profile");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    if (file.size > 2 * 1024 * 1024) {
      setError(t("avatarSizeError"));
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(t("avatarTypeError"));
      return;
    }

    setUploading(true);
    try {
      const result = await uploadAvatar(file);
      onUploaded(result.avatarUrl);
    } catch {
      setError(t("avatarUploadError"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <div
        className="relative group cursor-pointer"
        onClick={() => !uploading && fileRef.current?.click()}
      >
        <UserAvatar
          displayName={displayName}
          avatarUrl={avatarUrl}
          size="lg"
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="size-6 text-white animate-spin" />
          ) : (
            <Camera className="size-6 text-white" />
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {error && <p className="text-destructive text-xs mt-1">{error}</p>}
    </div>
  );
}
