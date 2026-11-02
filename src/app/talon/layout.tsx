import { Suspense } from "react";
import { Loading } from "@/components/ui";

export default function TicketLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
