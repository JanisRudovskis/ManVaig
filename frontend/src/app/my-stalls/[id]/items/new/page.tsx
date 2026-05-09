"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ItemForm } from "@/components/item-form";
import { fetchStall } from "@/lib/stalls";
import type { StallDefaults } from "@/lib/stalls";

export default function AddItemPage() {
  const router = useRouter();
  const params = useParams();
  const stallId = params.id as string;
  const { isLoggedIn, isLoading: authLoading } = useAuth();

  const [stallDefaults, setStallDefaults] = useState<StallDefaults | null>(null);
  const [stallLoaded, setStallLoaded] = useState(false);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/login");
    }
  }, [authLoading, isLoggedIn, router]);

  // Load stall defaults
  useEffect(() => {
    if (authLoading || !isLoggedIn || !stallId) return;
    let cancelled = false;
    fetchStall(stallId)
      .then((stall) => {
        if (cancelled) return;
        setStallDefaults({
          categoryId: stall.defaultCategoryId,
          location: stall.defaultLocation,
          canShip: stall.defaultCanShip,
          condition: stall.defaultCondition,
          acceptOffers: stall.defaultAcceptOffers,
          tags: stall.defaultTags,
          visibility: stall.visibility,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStallLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isLoggedIn, stallId]);

  if (authLoading || !stallLoaded) return null;

  return (
    <ItemForm
      mode="add"
      stallId={stallId}
      stallDefaults={stallDefaults ?? undefined}
      onSaved={() => router.push(`/my-stalls/${stallId}`)}
    />
  );
}
