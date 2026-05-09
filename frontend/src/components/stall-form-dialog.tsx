"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LocationSearch } from "@/components/location-search";
import { VisibilityRadioCards } from "@/components/visibility-radio-cards";
import {
  createStall,
  deleteStall,
  updateStall,
  StallVisibility,
  type CreateStallData,
  type StallResponse,
  type UpdateStallData,
} from "@/lib/stalls";
import {
  Condition,
  fetchCategories,
  type CategoryDto,
} from "@/lib/items";
import { cn } from "@/lib/utils";

const NAME_MIN = 3;
const NAME_MAX = 50;
const DESCRIPTION_MAX = 500;
const TAGS_MAX = 10;
const TAG_LENGTH_MAX = 30;

const conditionOptions = [
  { value: Condition.New, key: "condNew" },
  { value: Condition.LikeNew, key: "condLikeNew" },
  { value: Condition.Good, key: "condGood" },
  { value: Condition.Fair, key: "condFair" },
  { value: Condition.Poor, key: "condPoor" },
];

interface StallFormDialogProps {
  mode: "add" | "edit";
  stall?: StallResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (stall: StallResponse) => void;
  onDeleted?: () => void;
}

interface FormState {
  name: string;
  description: string;
  visibility: number;
  defaultCategoryId: number | null;
  defaultLocation: string;
  defaultTags: string[];
  defaultCondition: number | null;
  defaultCanShip: boolean;
  defaultAcceptOffers: boolean;
}

function initialState(stall?: StallResponse): FormState {
  return {
    name: stall?.name ?? "",
    description: stall?.description ?? "",
    visibility: stall?.visibility ?? StallVisibility.Public,
    defaultCategoryId: stall?.defaultCategoryId ?? null,
    defaultLocation: stall?.defaultLocation ?? "",
    defaultTags: stall?.defaultTags ?? [],
    defaultCondition: stall?.defaultCondition ?? null,
    defaultCanShip: stall?.defaultCanShip ?? false,
    defaultAcceptOffers: stall?.defaultAcceptOffers ?? false,
  };
}

function countDefaults(s: FormState): number {
  let c = 0;
  if (s.defaultCategoryId !== null) c++;
  if (s.defaultLocation.trim().length > 0) c++;
  if (s.defaultTags.length > 0) c++;
  if (s.defaultCondition !== null) c++;
  if (s.defaultCanShip) c++;
  if (s.defaultAcceptOffers) c++;
  return c;
}

export function StallFormDialog({
  mode,
  stall,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: StallFormDialogProps) {
  const t = useTranslations("stalls");
  const tc = useTranslations("categories");

  const [form, setForm] = useState<FormState>(() => initialState(stall));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tagInputRef = useRef<HTMLInputElement>(null);

  const headingPrefix = useId();
  const visibilityHeadingId = `${headingPrefix}-visibility`;
  const defaultsPanelId = `${headingPrefix}-defaults-panel`;
  const nameErrorId = `${headingPrefix}-name-error`;
  const descriptionErrorId = `${headingPrefix}-description-error`;
  const tagsErrorId = `${headingPrefix}-tags-error`;
  const formErrorId = `${headingPrefix}-form-error`;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm(initialState(stall));
      setErrors({});
      setFormError("");
      setTagInput("");
      setDefaultsOpen(false);
      setShowDeleteConfirm(false);
    }
  }, [open, stall]);

  // Load categories the first time the dialog opens
  useEffect(() => {
    if (open && categories.length === 0) {
      fetchCategories().then(setCategories).catch(() => {});
    }
  }, [open, categories.length]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
    setFormError("");
  };

  const validateName = (val: string): string | null => {
    const trimmed = val.trim();
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
      return t("errorNameLength");
    }
    return null;
  };

  const handleNameBlur = () => {
    const err = validateName(form.name);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next.name = err;
      else delete next.name;
      return next;
    });
  };

  const handleDescriptionBlur = () => {
    if (form.description.length > DESCRIPTION_MAX) {
      setErrors((prev) => ({
        ...prev,
        description: t("errorDescriptionLength"),
      }));
    }
  };

  // Tag input
  const addTag = (raw: string) => {
    const normalized = raw.trim().toLowerCase().slice(0, TAG_LENGTH_MAX);
    if (!normalized) return;
    if (form.defaultTags.includes(normalized)) return;
    if (form.defaultTags.length >= TAGS_MAX) {
      setErrors((prev) => ({ ...prev, tags: t("errors.tagsLimit") }));
      return;
    }
    update("defaultTags", [...form.defaultTags, normalized]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    update(
      "defaultTags",
      form.defaultTags.filter((tg) => tg !== tag),
    );
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && form.defaultTags.length > 0) {
      update("defaultTags", form.defaultTags.slice(0, -1));
    }
  };

  // Submit
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return;

    setFormError("");
    const errs: Record<string, string> = {};
    const nameErr = validateName(form.name);
    if (nameErr) errs.name = nameErr;
    if (form.description.length > DESCRIPTION_MAX) {
      errs.description = t("errorDescriptionLength");
    }
    if (form.defaultTags.length > TAGS_MAX) {
      errs.tags = t("errors.tagsLimit");
    } else if (form.defaultTags.some((tg) => tg.length > TAG_LENGTH_MAX)) {
      errs.tags = t("errors.tagsLimit");
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        visibility: form.visibility,
        defaultCategoryId: form.defaultCategoryId,
        defaultLocation: form.defaultLocation.trim() || undefined,
        defaultTags: form.defaultTags,
        defaultCondition: form.defaultCondition,
        defaultCanShip: form.defaultCanShip,
        defaultAcceptOffers: form.defaultAcceptOffers,
      };

      let result: StallResponse;
      if (mode === "add") {
        result = await createStall(payload as CreateStallData);
      } else {
        if (!stall) throw new Error("missing_stall");
        result = await updateStall(stall.id, payload as UpdateStallData);
      }

      onSaved(result);
      onOpenChange(false);
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      switch (code) {
        case "NAME_TAKEN":
          setErrors((prev) => ({ ...prev, name: t("errors.nameTaken") }));
          break;
        case "NAME_LENGTH":
          setErrors((prev) => ({ ...prev, name: t("errorNameLength") }));
          break;
        case "IS_DEFAULT_REQUIRES_PUBLIC":
          setFormError(t("errors.isDefaultRequiresPublic"));
          break;
        case "TAGS_LIMIT":
        case "TAG_LENGTH":
          setErrors((prev) => ({ ...prev, tags: t("errors.tagsLimit") }));
          break;
        case "INVALID_CATEGORY":
          setFormError(t("errors.invalidCategory"));
          break;
        default:
          setFormError(t("errorCreateFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete (edit mode)
  const handleDelete = async () => {
    if (!stall) return;
    setDeleting(true);
    try {
      await deleteStall(stall.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      setFormError(code === "LAST_STALL" ? t("errorLastStall") : t("errorCreateFailed"));
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const defaultsCount = countDefaults(form);
  const isAdd = mode === "add";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (saving || deleting) return;
          onOpenChange(v);
        }}
      >
        <DialogContent
          className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0 sm:max-w-lg max-h-[90vh]"
          aria-describedby={undefined}
        >
          <form onSubmit={handleSubmit} className="contents">
            <div className="px-4 pt-4 pb-2 pr-12">
              <DialogTitle className="text-base font-semibold">
                {isAdd ? t("dialogAddTitle") : t("dialogEditTitle")}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {isAdd ? t("dialogAddSubtitle") : t("dialogEditSubtitle")}
              </DialogDescription>
            </div>

            <div className="min-h-0 overflow-y-auto px-4 py-3 space-y-6">
              {/* Identity */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("identitySection")}
                </h3>

                <div>
                  <Label htmlFor={`${headingPrefix}-name`} className="mb-1.5">
                    {t("name")} <span aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id={`${headingPrefix}-name`}
                    autoFocus
                    value={form.name}
                    maxLength={NAME_MAX}
                    onChange={(e) => update("name", e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder={t("namePlaceholder")}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? nameErrorId : undefined}
                  />
                  {errors.name && (
                    <p
                      id={nameErrorId}
                      className="mt-1 text-xs text-destructive"
                    >
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`${headingPrefix}-description`} className="mb-1.5">
                    {t("description")}
                  </Label>
                  <Textarea
                    id={`${headingPrefix}-description`}
                    value={form.description}
                    onChange={(e) =>
                      update("description", e.target.value.slice(0, DESCRIPTION_MAX))
                    }
                    onBlur={handleDescriptionBlur}
                    placeholder={t("descriptionPlaceholder")}
                    rows={3}
                    aria-invalid={!!errors.description}
                    aria-describedby={
                      errors.description ? descriptionErrorId : undefined
                    }
                  />
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {errors.description ? (
                      <p
                        id={descriptionErrorId}
                        className="text-xs text-destructive"
                      >
                        {errors.description}
                      </p>
                    ) : (
                      <span />
                    )}
                    <span
                      className={cn(
                        "text-xs",
                        form.description.length > DESCRIPTION_MAX - 50
                          ? "text-orange-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {form.description.length} / {DESCRIPTION_MAX}
                    </span>
                  </div>
                </div>

                {!isAdd && stall?.slug && (
                  <p className="text-xs text-muted-foreground">
                    {t("stallUrlLabel")}:{" "}
                    <span className="font-mono">/stalls/{stall.slug}</span>
                  </p>
                )}
              </section>

              {/* Visibility */}
              <section className="space-y-2">
                <h3
                  id={visibilityHeadingId}
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t("visibilitySection")}
                </h3>
                <VisibilityRadioCards
                  mode="stall"
                  value={form.visibility}
                  onChange={(v) => update("visibility", v)}
                  labelledBy={visibilityHeadingId}
                />
              </section>

              {/* Defaults (collapsible) */}
              <section className="space-y-2">
                <button
                  type="button"
                  onClick={() => setDefaultsOpen((v) => !v)}
                  aria-expanded={defaultsOpen}
                  aria-controls={defaultsPanelId}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-sm font-medium text-foreground">
                    {t("defaultsSection")}
                  </span>
                  <span className="flex items-center gap-2">
                    {defaultsCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {t("defaultsBadge", { count: defaultsCount })}
                      </span>
                    )}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        defaultsOpen && "rotate-180",
                      )}
                    />
                  </span>
                </button>

                {defaultsOpen && (
                  <div
                    id={defaultsPanelId}
                    className="space-y-5 rounded-lg border border-border/60 bg-muted/20 p-3"
                  >
                    {/* Content sub-group */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {t("defaultsContent")}
                      </h4>

                      <div>
                        <Label
                          htmlFor={`${headingPrefix}-defcat`}
                          className="mb-1.5"
                        >
                          {t("defaultCategory")}
                        </Label>
                        <select
                          id={`${headingPrefix}-defcat`}
                          value={form.defaultCategoryId ?? 0}
                          onChange={(e) =>
                            update(
                              "defaultCategoryId",
                              e.target.value === "0"
                                ? null
                                : parseInt(e.target.value),
                            )
                          }
                          className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 [&>option]:bg-background [&>option]:text-foreground"
                        >
                          <option value={0}>{t("defaultCategoryNone")}</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {tc.has(String(c.id)) ? tc(String(c.id)) : c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="mb-1.5">{t("defaultLocation")}</Label>
                        <LocationSearch
                          value={form.defaultLocation}
                          onChange={(v) => update("defaultLocation", v)}
                          placeholder={t("defaultLocationPlaceholder")}
                        />
                      </div>

                      <div>
                        <Label className="mb-1.5">{t("defaultTags")}</Label>
                        <div
                          className="flex min-h-[40px] cursor-text flex-wrap items-center gap-1.5 rounded-md border border-border bg-input px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25"
                          onClick={() => tagInputRef.current?.focus()}
                        >
                          {form.defaultTags.map((tag) => (
                            <span
                              key={tag}
                              className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-foreground"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                aria-label={`${t("defaultTags")} — ${tag}`}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ))}
                          <input
                            ref={tagInputRef}
                            type="text"
                            value={tagInput}
                            onChange={(e) =>
                              setTagInput(e.target.value.slice(0, TAG_LENGTH_MAX))
                            }
                            onKeyDown={handleTagKeyDown}
                            placeholder={
                              form.defaultTags.length === 0
                                ? t("defaultTagsPlaceholder")
                                : ""
                            }
                            aria-invalid={!!errors.tags}
                            aria-describedby={errors.tags ? tagsErrorId : undefined}
                            className="min-w-[100px] flex-1 border-0 bg-transparent text-xs text-foreground outline-none"
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          {errors.tags ? (
                            <p
                              id={tagsErrorId}
                              className="text-xs text-destructive"
                            >
                              {errors.tags}
                            </p>
                          ) : (
                            <span />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {form.defaultTags.length} / {TAGS_MAX}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Commerce sub-group */}
                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {t("defaultsCommerce")}
                      </h4>

                      <div>
                        <Label className="mb-1.5">{t("defaultCondition")}</Label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="flex w-fit gap-0 rounded-md bg-muted p-0.5">
                            {conditionOptions.map((opt) => {
                              const checked = form.defaultCondition === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    update("defaultCondition", opt.value)
                                  }
                                  aria-pressed={checked}
                                  className={cn(
                                    "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                                    checked
                                      ? "bg-card text-foreground shadow-sm"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  {/* condition labels live in itemForm namespace */}
                                  <ConditionLabel optKey={opt.key} />
                                </button>
                              );
                            })}
                          </div>
                          {form.defaultCondition !== null && (
                            <button
                              type="button"
                              onClick={() => update("defaultCondition", null)}
                              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                            >
                              {t("defaultConditionNone")}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {t("defaultCanShip")}
                          </p>
                        </div>
                        <Switch
                          checked={form.defaultCanShip}
                          onCheckedChange={(v) => update("defaultCanShip", v)}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {t("defaultAcceptOffers")}
                          </p>
                        </div>
                        <Switch
                          checked={form.defaultAcceptOffers}
                          onCheckedChange={(v) =>
                            update("defaultAcceptOffers", v)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Form-level error */}
              {formError && (
                <div
                  id={formErrorId}
                  role="alert"
                  aria-live="polite"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {formError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-muted/40 p-4 sm:flex-row sm:items-center">
              {!isAdd && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving || deleting}
                  className="sm:mr-auto"
                >
                  <Trash2 className="size-3.5 mr-1" />
                  {t("deleteStall")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || deleting}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saving || deleting}
                aria-busy={saving || undefined}
              >
                {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {!isAdd && stall && (
        <ConfirmDialog
          open={showDeleteConfirm}
          title={t("deleteStall")}
          description={t("deleteConfirm", { count: stall.itemCount })}
          confirmLabel={t("confirmDelete")}
          cancelLabel={t("cancel")}
          variant="destructive"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

function ConditionLabel({ optKey }: { optKey: string }) {
  const ti = useTranslations("itemForm");
  return <>{ti(optKey)}</>;
}
