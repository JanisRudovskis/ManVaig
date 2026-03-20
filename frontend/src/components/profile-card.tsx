"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarUpload } from "@/components/avatar-upload";
import { BadgeDisplay } from "@/components/badge-display";
import { updateProfile } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth";
import { useLocale } from "next-intl";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Send,
  Pencil,
  X,
  Loader2,
  Globe,
  Lock,
} from "lucide-react";

// Communication channel flags (must match backend enum)
const CHANNEL_WHATSAPP = 1;
const CHANNEL_TELEGRAM = 2;

interface ProfileCardProps {
  profile: UserProfile;
  isOwner: boolean;
  onProfileUpdated?: (profile: UserProfile) => void;
}

export function ProfileCard({
  profile,
  isOwner,
  onProfileUpdated,
}: ProfileCardProps) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit state
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [isPublic, setIsPublic] = useState(profile.isProfilePublic);
  const [channels, setChannels] = useState(profile.enabledChannels);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);

  function startEditing() {
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setPhone(profile.phone ?? "");
    setIsPublic(profile.isProfilePublic);
    setChannels(profile.enabledChannels);
    setEditing(true);
    setError("");
  }

  function cancelEditing() {
    setEditing(false);
    setError("");
    setAvatarUrl(profile.avatarUrl);
  }

  function validate(): string | null {
    if (bio.length > 1000) return t("errorBioLength");
    if (location.length > 200) return t("errorLocationLength");
    if (phone.length > 30) return t("errorPhoneLength");
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await updateProfile({
        bio,
        location,
        phone,
        isProfilePublic: isPublic,
        enabledChannels: channels,
      });
      setEditing(false);
      onProfileUpdated?.(updated);
    } catch {
      setError(t("errorSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(flag: number) {
    setChannels((prev) => (prev & flag ? prev & ~flag : prev | flag));
  }

  const memberDateObj = new Date(profile.memberSince);
  const localeTag = locale === "lv" ? "lv-LV" : "en-US";
  const monthName = memberDateObj.toLocaleDateString(localeTag, { month: "long" });
  const year = memberDateObj.getFullYear();
  const memberDate = locale === "lv"
    ? `${monthName} ${year}`
    : `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;

  const hasWhatsApp = !!((editing ? channels : profile.enabledChannels) & CHANNEL_WHATSAPP);
  const hasTelegram = !!((editing ? channels : profile.enabledChannels) & CHANNEL_TELEGRAM);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        {/* Main layout: avatar left, info right */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0 flex justify-center sm:justify-start">
            {isOwner && editing ? (
              <AvatarUpload
                displayName={profile.displayName}
                avatarUrl={avatarUrl}
                onUploaded={(url) => setAvatarUrl(url)}
              />
            ) : (
              <UserAvatar
                displayName={profile.displayName}
                avatarUrl={avatarUrl ?? profile.avatarUrl}
                size="lg"
              />
            )}
          </div>

          {/* Info section */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Display Name + Badges */}
            <div>
              <h2 className="text-xl font-bold truncate">
                {profile.displayName}
              </h2>
              <BadgeDisplay badges={profile.displayedBadges} />
            </div>

            {/* Email (owner only) */}
            {isOwner && profile.email && (
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                <Mail className="size-4 flex-shrink-0" />
                <span>{profile.email}</span>
                {profile.emailConfirmed ? (
                  <span className="flex items-center gap-1 text-emerald-500 text-xs whitespace-nowrap">
                    <CheckCircle className="size-3.5" />
                    {t("emailVerified")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-500 text-xs whitespace-nowrap">
                    <AlertCircle className="size-3.5" />
                    {t("emailUnverified")}
                  </span>
                )}
              </div>
            )}

            {/* Phone (owner only) */}
            {isOwner && (
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                <Phone className="size-4 flex-shrink-0" />
                {editing ? (
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("phonePlaceholder")}
                    className="h-8 text-sm max-w-64"
                  />
                ) : (
                  <span>{profile.phone || t("phoneNotSet")}</span>
                )}
                {!editing && profile.phone && (
                  <span className="flex items-center gap-1 text-amber-500 text-xs whitespace-nowrap">
                    <AlertCircle className="size-3.5" />
                    {t("phoneUnverified")}
                  </span>
                )}
              </div>
            )}

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 flex-shrink-0" />
              {editing ? (
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("locationPlaceholder")}
                  className="h-8 text-sm max-w-64"
                />
              ) : (
                <span>{profile.location || t("locationNotSet")}</span>
              )}
            </div>

            {/* Member since */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4 flex-shrink-0" />
              <span>
                {t("memberSince")} {memberDate}
              </span>
            </div>
          </div>

          {/* Edit button (top right) */}
          {isOwner && !editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={startEditing}
              className="self-start"
            >
              <Pencil className="size-3.5 mr-1" />
              {t("editProfile")}
            </Button>
          )}
        </div>

        {/* Bio section */}
        <Separator className="my-4" />
        <div>
          {editing ? (
            <div>
              <Label className="text-sm font-medium">{t("bio")}</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t("bioPlaceholder")}
                className="mt-1 min-h-20"
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {bio.length}/1000
              </p>
            </div>
          ) : (
            (profile.bio || isOwner) && (
              <p className={`text-sm text-muted-foreground ${!profile.bio ? "italic" : ""}`}>
                {profile.bio || t("bioNotSet")}
              </p>
            )
          )}
        </div>

        {/* Communication Channels — hidden for non-owners when phone unverified */}
        {(isOwner || profile.phoneVerified) && (
          <div className="mt-4">
            {editing ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("communicationChannels")}
                </Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={!!(channels & CHANNEL_WHATSAPP)}
                      onCheckedChange={() => toggleChannel(CHANNEL_WHATSAPP)}
                    />
                    <MessageCircle className="size-4 text-green-500" />
                    <span className="text-sm">{t("whatsapp")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={!!(channels & CHANNEL_TELEGRAM)}
                      onCheckedChange={() => toggleChannel(CHANNEL_TELEGRAM)}
                    />
                    <Send className="size-4 text-blue-500" />
                    <span className="text-sm">{t("telegram")}</span>
                  </label>
                </div>
              </div>
            ) : (
              (hasWhatsApp || hasTelegram) && (
                <div className="flex gap-3">
                  {hasWhatsApp && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MessageCircle className="size-4 text-green-500" />
                      {t("whatsapp")}
                    </span>
                  )}
                  {hasTelegram && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Send className="size-4 text-blue-500" />
                      {t("telegram")}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Profile Visibility (editing only) */}
        {editing && (
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              {isPublic ? (
                <Globe className="size-4 text-emerald-500" />
              ) : (
                <Lock className="size-4 text-amber-500" />
              )}
              <span className="text-sm">
                {isPublic ? t("profilePublic") : t("profilePrivate")}
              </span>
            </label>
            <p className="text-xs text-muted-foreground mt-1 ml-10">
              {isPublic
                ? t("profilePublicDescription")
                : t("profilePrivateDescription")}
            </p>
          </div>
        )}

        {/* Error + Save/Cancel buttons */}
        {editing && (
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              {t("saveChanges")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEditing}
              disabled={saving}
            >
              <X className="size-3.5 mr-1" />
              {t("cancel")}
            </Button>
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
