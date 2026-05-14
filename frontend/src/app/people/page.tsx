import { redirect } from "next/navigation";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const url = params.q
    ? `/search?tab=people&q=${encodeURIComponent(params.q)}`
    : "/search?tab=people";
  redirect(url);
}
