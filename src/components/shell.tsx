"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { api, useApi } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";
import { IconGear, IconHome, IconList, IconLogout, IconPlus, IconTag, IconUsers, Logo } from "./icons";
import { Loading } from "./ui";

const UserContext = createContext<SessionUser | null>(null);
export const useUser = () => useContext(UserContext);

const NAV = [
  { href: "/", label: "Panel", icon: IconHome },
  { href: "/ordenes", label: "Órdenes", icon: IconList },
  { href: "/ordenes/nueva", label: "Nueva", icon: IconPlus, primary: true },
  { href: "/clientes", label: "Clientes", icon: IconUsers },
  { href: "/precios", label: "Precios", icon: IconTag },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/ordenes") return path.startsWith("/ordenes") && path !== "/ordenes/nueva";
  return path.startsWith(href);
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { data: user } = useApi<SessionUser>("/api/auth/me");

  return (
    <UserContext.Provider value={user}>
      <div className="min-h-dvh lg:pl-64">
        {/* Barra lateral (PC) */}
        <aside className="no-print fixed inset-y-0 left-0 hidden w-64 flex-col bg-ink px-4 py-6 text-white lg:flex">
          <div className="mb-8 px-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">Lavadero</p>
            <Logo className="text-3xl text-white" />
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map(({ href, label, icon: Icon, primary }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  primary
                    ? "my-2 bg-brand font-medium text-white hover:bg-brand-strong"
                    : isActive(path, href)
                      ? "bg-white/10 font-medium text-white"
                      : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon />
                {primary ? "Nueva orden" : label}
              </Link>
            ))}
            {user?.role === "admin" && (
              <Link
                href="/config"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive(path, "/config") ? "bg-white/10 font-medium" : "text-white/65 hover:bg-white/5 hover:text-white"}`}
              >
                <IconGear />
                Configuración
              </Link>
            )}
          </nav>
          {user && (
            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="text-xs text-white/50">{user.role === "admin" ? "Administrador" : "Empleado"}</p>
              </div>
              <button onClick={logout} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" title="Salir">
                <IconLogout />
              </button>
            </div>
          )}
        </aside>

        {/* Barra superior (celular) */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo className="text-2xl text-ink" />
          <div className="flex items-center gap-1">
            {user?.role === "admin" && (
              <Link href="/config" className="rounded-lg p-2 text-ink-soft hover:bg-brand-soft" aria-label="Configuración">
                <IconGear />
              </Link>
            )}
            <button onClick={logout} className="rounded-lg p-2 text-ink-soft hover:bg-brand-soft" aria-label="Salir">
              <IconLogout />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">{user ? children : <Loading />}</main>

        {/* Navegación inferior (celular) */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 backdrop-blur lg:hidden">
          {NAV.map(({ href, label, icon: Icon, primary }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-0.5 py-1 text-[11px]">
              {primary ? (
                <span className="-mt-6 flex size-13 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30">
                  <Icon width={26} height={26} />
                </span>
              ) : (
                <Icon className={isActive(path, href) ? "text-brand" : "text-muted"} />
              )}
              <span className={isActive(path, href) ? "font-medium text-brand" : "text-muted"}>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </UserContext.Provider>
  );
}
