import { Suspense } from "react";
import type { Metadata } from "next";
import DbMessages from "@/components/db/DbMessages";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <Suspense>
      <DbMessages />
    </Suspense>
  );
}
