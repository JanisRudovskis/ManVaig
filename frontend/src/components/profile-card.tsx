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
import { LocationSearch } from "@/components/location-search";
import { EmailManagement } from "@/components/email-management";
import { PhoneManagement } from "@/components/phone-management";
import { updateProfile } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "next-intl";
import { ProfilePopup } from "@/components/profile-popup";
import { getLastSeenStatus, formatMemberDate } from "@/lib/profile-utils";
import {
  MapPin,
  Calendar,
  AlertCircle,
  MessageCircle,
  Send,
  Pencil,
  X,
  Loader2,
  Globe,
  Lock,
  Store,
  Package,
  Handshake,
  Circle,
  Eye,
  Mail,
  Phone,
} from "lucide-react";

// Communication channel flags (must match backend enum)
const CHANNEL_WHATSAPP = 1;
const CHANNEL_TELEGRAM = 2;
const CHANNEL_SHOW_EMAIL = 4;
const CHANNEL_SHOW_PHONE = 8;

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
  const { updateAvatarUrl } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  // Edit state
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [telegramUsername, setTelegramUsername] = useState(profile.telegramUsername ?? "");
  const [isPublic, setIsPublic] = useState(profile.isProfilePublic);
  const [channels, setChannels] = useState(profile.enabledChannels);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);

  function startEditing() {
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setTelegramUsername(profile.telegramUsername ?? "");
    setIsPublic(profile.isProfilePublic);
    setChannels(profile.enabledChannels);
    setEditing(true);
    setError("");
  }

  function cancelEditing() {
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setTelegramUsername(profile.telegramUsername ?? "");
    setIsPublic(profile.isProfilePublic);
    setChannels(profile.enabledChannels);
    setAvatarUrl(profile.avatarUrl);
    setEditing(false);
    setError("");
  }

  function validate(): string | null {
    if (bio.length > 1000) return t("errorBioLength");
    if (location.length > 200) return t("errorLocationLength");
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
        telegramUsername,
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

  const memberDate = formatMemberDate(profile.memberSince, locale);
  const lastSeenStatus = getLastSeenStatus(profile.lastSeenAt, t);

  const ch = editing ? channels : profile.enabledChannels;
  const hasWhatsApp = !!(ch & CHANNEL_WHATSAPP);
  const hasTelegram = !!(ch & CHANNEL_TELEGRAM);
  const hasShowEmail = !!(ch & CHANNEL_SHOW_EMAIL);
  const hasShowPhone = !!(ch & CHANNEL_SHOW_PHONE);

  // For owner view: phone verification status (always false in v1 for now)
  const phoneVerified = !!profile.phoneVerified;
  // Contact channels are always editable — private profiles are still visible to logged-in users

  const ownerHasAnyContactChip =
    (hasShowEmail && !!profile.email) ||
    (hasShowPhone && !!profile.phone) ||
    (hasTelegram && !!profile.telegramUsername);
  const publicHasAnyContact = !!(
    profile.publicEmail || profile.publicPhone || profile.publicTelegramUrl
  );
  const showBioSection = editing || !!profile.bio || isOwner;
  const showChannelsSection =
    editing || (isOwner ? ownerHasAnyContactChip : publicHasAnyContact);

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
                onUploaded={(url) => { setAvatarUrl(url); updateAvatarUrl(url); }}
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
            {/* Display Name + Badges + (desktop) action buttons */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xl font-bold truncate">
                  {profile.displayName}
                </h2>
                <BadgeDisplay badges={profile.displayedBadges} />
              </div>
              {isOwner && !editing && (
                <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditing}
                  >
                    <Pencil className="size-3.5 mr-1" />
                    {t("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPopup(true)}
                  >
                    <Eye className="size-3.5 mr-1" />
                    {t("view")}
                  </Button>
                </div>
              )}
            </div>

            {/* Profile Visibility — master switch (hoisted to top of edit) */}
            {editing && (
              <Label
                htmlFor="profile-visibility-switch"
                className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer font-normal"
              >
                <Switch
                  id="profile-visibility-switch"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    {isPublic ? (
                      <Globe className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Lock className="size-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <span className="text-sm font-medium">
                      {isPublic ? t("profilePublic") : t("profilePrivate")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isPublic
                      ? t("profilePublicDescription")
                      : t("profilePrivateDescription")}
                  </p>
                </div>
              </Label>
            )}

            {/* Email (owner only) */}
            {isOwner && profile.email && (
              <EmailManagement
                email={profile.email}
                emailConfirmed={!!profile.emailConfirmed}
                editing={editing}
              />
            )}

            {/* Phone (owner only) */}
            {isOwner && (
              <PhoneManagement
                phone={profile.phone}
                phoneVerified={!!profile.phoneVerified}
                editing={editing}
              />
            )}

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 flex-shrink-0" />
              {editing ? (
                <LocationSearch
                  value={location}
                  onChange={setLocation}
                  placeholder={t("locationPlaceholder")}
                  className="max-w-72 sm:max-w-80 flex-1"
                />
              ) : profile.location ? (
                <span>{profile.location}</span>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="italic hover:text-foreground transition-colors"
                >
                  {t("locationNotSet")}
                </button>
              ) : (
                <span>{t("locationNotSet")}</span>
              )}
            </div>

            {/* Member since */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4 flex-shrink-0" />
              <span>
                {t("memberSince")} {memberDate}
              </span>
            </div>

            {/* Last seen */}
            {lastSeenStatus.text && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Circle
                  className={`size-3 flex-shrink-0 fill-current ${
                    lastSeenStatus.isOnline
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground/50"
                  }`}
                />
                <span
                  className={
                    lastSeenStatus.isOnline
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : ""
                  }
                >
                  {lastSeenStatus.text}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons — mobile only (desktop shows them inline with name) */}
          {isOwner && !editing && (
            <div className="flex sm:hidden items-center gap-1.5 self-start">
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
              >
                <Pencil className="size-3.5 mr-1" />
                {t("edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPopup(true)}
              >
                <Eye className="size-3.5 mr-1" />
                {t("view")}
              </Button>
            </div>
          )}
        </div>

        {/* Stats bar */}
        {(profile.stallCount > 0 || profile.activeListingCount > 0 || profile.completedDealCount > 0) && (
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
              <Store className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{profile.stallCount}</span>
              <span className="text-muted-foreground">{t("statsStalls", { count: profile.stallCount })}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
              <Package className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{profile.activeListingCount}</span>
              <span className="text-muted-foreground">{t("statsItems", { count: profile.activeListingCount })}</span>
            </div>
            {profile.completedDealCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm">
                <Handshake className="size-3.5 text-emerald-700 dark:text-emerald-300" />
                <span className="font-medium text-emerald-700 dark:text-emerald-300">{profile.completedDealCount}</span>
                <span className="text-emerald-700/80 dark:text-emerald-300/80">{t("statsDeals", { count: profile.completedDealCount })}</span>
              </div>
            )}
          </div>
        )}

        {/* Bio section */}
        {showBioSection && !editing && <Separator className="my-4" />}
        {showBioSection && <div className={editing ? "mt-6" : ""}>
          {editing ? (
            <>
              <Label htmlFor="profile-bio" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("bio")}</Label>
              <Textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t("bioPlaceholder")}
                className="mt-2 min-h-20"
              />
              <p className={`text-xs mt-1 text-right ${bio.length > 1000 ? "text-destructive" : "text-muted-foreground"}`}>
                {bio.length}/1000
              </p>
            </>
          ) : (
            (profile.bio || isOwner) && (
              profile.bio ? (
                <p className="text-sm text-muted-foreground">{profile.bio}</p>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="text-sm italic text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("bioNotSet")}
                </button>
              ) : null
            )
          )}
        </div>}

        {/* Communication Channels */}
        {showChannelsSection && !editing && <Separator className="my-4" />}
        {showChannelsSection && (editing ? (
          <div
            className="mt-6 space-y-3"
          >
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("contactInfo")}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t("contactInfoDescription")}
              </p>
            </div>
            <div className="space-y-2.5">
              {/* Email — only if email is verified */}
              {profile.emailConfirmed && (
                <label className={"flex items-center gap-2 cursor-pointer"}>
                  <Switch
                    checked={hasShowEmail}
                    onCheckedChange={() => toggleChannel(CHANNEL_SHOW_EMAIL)}

                  />
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="text-sm">{t("email")}</span>
                </label>
              )}

              {/* Phone — only if phone is verified */}
              {phoneVerified && (
                <div className="space-y-2">
                  <label className={"flex items-center gap-2 cursor-pointer"}>
                    <Switch
                      checked={hasShowPhone}
                      onCheckedChange={(checked) => {
                        toggleChannel(CHANNEL_SHOW_PHONE);
                        if (!checked && hasWhatsApp) toggleChannel(CHANNEL_WHATSAPP);
                      }}
  
                    />
                    <Phone className="size-4 text-muted-foreground" />
                    <span className="text-sm">{t("phoneNumber")}</span>
                  </label>
                  {/* WhatsApp — sub-option, only when phone is visible */}
                  {hasShowPhone && (
                    <label className={"flex items-center gap-2 ml-8 cursor-pointer"}>
                      <Switch
                        checked={hasWhatsApp}
                        onCheckedChange={() => toggleChannel(CHANNEL_WHATSAPP)}
    
                      />
                      <MessageCircle className="size-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">{t("whatsapp")}</span>
                    </label>
                  )}
                </div>
              )}

              {/* Telegram — always available, inline input */}
              <div className="flex flex-wrap items-center gap-2">
                <label className={"flex items-center gap-2 cursor-pointer"}>
                  <Switch
                    checked={hasTelegram}
                    onCheckedChange={() => toggleChannel(CHANNEL_TELEGRAM)}

                  />
                  <Send className="size-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm">{t("telegram")}</span>
                </label>
                {hasTelegram && (
                  <Input
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder={t("telegramPlaceholder")}
                    className="h-7 text-sm flex-1 min-w-[120px] max-w-48"

                  />
                )}
              </div>

              {/* Hint for unverified phone */}
              {!phoneVerified && (
                <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <AlertCircle className="size-3" />
                  {t("phoneRequiredHint")}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* View mode — owner sees same chips as public visitors (non-clickable for owner) */
          renderContactChips({
            isOwner,
            hasShowEmail,
            hasShowPhone,
            hasWhatsApp,
            hasTelegram,
            profile,
          })
        ))}

        {/* Sticky Save/Cancel footer in edit mode */}
        {editing && (
          <div className="sticky bottom-0 -mx-6 mt-4 border-t bg-card/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 z-10">
            {error && (
              <p className="text-destructive text-sm mb-2">{error}</p>
            )}
            <div className="flex items-center gap-3">
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
            </div>
          </div>
        )}
      </CardContent>

      {/* Profile preview popup */}
      {showPopup && (
        <ProfilePopup
          displayName={profile.displayName}
          onClose={() => setShowPopup(false)}
        />
      )}
    </Card>
  );
}

interface ContactChipsParams {
  isOwner: boolean;
  hasShowEmail: boolean;
  hasShowPhone: boolean;
  hasWhatsApp: boolean;
  hasTelegram: boolean;
  profile: UserProfile;
}

function renderContactChips({
  isOwner,
  hasShowEmail,
  hasShowPhone,
  hasWhatsApp,
  hasTelegram,
  profile,
}: ContactChipsParams) {
  // Owner viewing their own profile: show chips with their actual values (non-clickable)
  if (isOwner) {
    const showAny =
      (hasShowEmail && profile.email) ||
      (hasShowPhone && profile.phone) ||
      (hasTelegram && profile.telegramUsername);
    if (!showAny) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {hasShowEmail && profile.email && (
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5" />
            <span className="truncate max-w-[200px]">{profile.email}</span>
          </span>
        )}
        {hasShowPhone && profile.phone && (
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5" />
              <span>{profile.phone}</span>
            </span>
            {hasWhatsApp && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700 dark:text-green-300">
                <MessageCircle className="size-3.5" />
                WhatsApp
              </span>
            )}
          </div>
        )}
        {hasTelegram && profile.telegramUsername && (
          <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300">
            <Send className="size-3.5" />
            @{profile.telegramUsername}
          </span>
        )}
      </div>
    );
  }

  // Public viewer: clickable contact links (uses public* fields from API)
  if (!profile.publicEmail && !profile.publicPhone && !profile.publicTelegramUrl) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {profile.publicEmail && (
        <a
          href={`mailto:${profile.publicEmail}`}
          className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm transition-colors hover:bg-muted/80"
        >
          <Mail className="size-3.5 text-muted-foreground" />
          <span className="truncate max-w-[200px]">{profile.publicEmail}</span>
        </a>
      )}
      {profile.publicPhone && (
        <div className="flex items-center gap-1.5">
          <a
            href={`tel:${profile.publicPhone}`}
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm transition-colors hover:bg-muted/80"
          >
            <Phone className="size-3.5 text-muted-foreground" />
            <span>{profile.publicPhone}</span>
          </a>
          {profile.publicWhatsAppUrl && (
            <a
              href={profile.publicWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700 dark:text-green-300 transition-colors hover:bg-green-500/20"
            >
              <MessageCircle className="size-3.5" />
              WhatsApp
            </a>
          )}
        </div>
      )}
      {profile.publicTelegramUrl && (
        <a
          href={profile.publicTelegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-500/20"
        >
          <Send className="size-3.5" />
          Telegram
        </a>
      )}
    </div>
  );
}
