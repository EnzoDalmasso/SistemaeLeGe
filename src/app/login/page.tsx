"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/icons";
import { Button, ErrorBox, Field, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { username, password } });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-brand/20 blur-3xl" />
      </div>
      <form onSubmit={submit} className="relative w-full max-w-sm rounded-3xl bg-card p-7 shadow-2xl">
        <div className="mb-7 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Lavadero industrial</p>
          <Logo className="mt-1 text-5xl text-ink" />
        </div>
        <div className="space-y-4">
          <Field label="Usuario">
            <input className={inputCls} autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Field>
          <Field label="Contraseña">
            <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <ErrorBox>{error}</ErrorBox>
          <Button type="submit" loading={loading} className="w-full">
            Ingresar
          </Button>
        </div>
      </form>
    </main>
  );
}
