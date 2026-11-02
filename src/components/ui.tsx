"use client";

import Link from "next/link";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { STATUS_LABELS } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong shadow-sm shadow-brand/20",
  secondary: "bg-card text-ink border border-line hover:border-brand/40 hover:bg-brand-soft/40",
  ghost: "text-ink-soft hover:bg-brand-soft/60",
  danger: "bg-card text-bad border border-bad/30 hover:bg-bad-soft",
  success: "bg-ok text-white hover:brightness-110 shadow-sm shadow-ok/20",
};

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "secondary", className = "", children, external }: { href: string; variant?: Variant; className?: string; children: ReactNode; external?: boolean }) {
  const cls = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition ${variants[variant]} ${className}`;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-block text-sm text-muted hover:text-brand">
            ← Volver
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const statusStyle: Record<keyof typeof STATUS_LABELS, string> = {
  recibido: "bg-info-soft text-info",
  lavando: "bg-brand-soft text-brand-strong",
  listo: "bg-warn-soft text-warn",
  entregado: "bg-ok-soft text-ok",
  cancelado: "bg-bad-soft text-bad",
};

export function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[status]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full min-h-11 rounded-xl border border-line bg-card px-3 text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-3 focus:ring-brand/15";

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-xl border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-muted">{children}</div>;
}

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-brand">
      <Spinner className="size-6" />
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
