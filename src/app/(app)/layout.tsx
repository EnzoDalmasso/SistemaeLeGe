import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { Loading } from "@/components/ui";

// Todo el panel depende de la URL y de la sesión: se renderiza en el cliente dentro de Suspense.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
