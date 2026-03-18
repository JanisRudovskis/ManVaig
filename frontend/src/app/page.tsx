import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("home");

  return (
    <div>
      <h1 className="text-2xl font-bold text-wrap-balance">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">
        {t("subtitle")}
      </p>
    </div>
  );
}
