"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ItemForm } from "@/components/item-form";

export default function AddItemPage() {
  const router = useRouter();
  const params = useParams();
  const stallId = params.id as string;
  const { isLoggedIn, isLoading: authLoading } = useAuth();

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/login");
    }
  }, [authLoading, isLoggedIn, router]);

  if (authLoading) return null;

  return (
    <ItemForm
      mode="add"
      stallId={stallId}
      onSaved={() => router.push(`/my-stalls/${stallId}`)}
    />
  );
}
