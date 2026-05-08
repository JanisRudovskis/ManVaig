import type { Metadata } from "next";
import { Suspense } from "react";
import { PeopleClient } from "./people-client";

export const metadata: Metadata = {
  title: "People · ManVaig",
  robots: { index: false },
};

export default function PeoplePage() {
  return (
    <Suspense fallback={null}>
      <PeopleClient />
    </Suspense>
  );
}
