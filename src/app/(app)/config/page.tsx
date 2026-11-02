"use client";

import { useState } from "react";
import { useUser } from "@/components/shell";
import { Button, Card, ErrorBox, Field, inputCls, Loading, Modal, PageHeader } from "@/components/ui";
import { api, useApi } from "@/lib/client";

type SettingsResp = {
  settings: { business_name: string; business_phone: string; ready_template: string };
  integrations: { telegram: boolean; botUsername: string | null; ai: boolean; aiProvider: string | null };
};
type U = { id: number; username: string; name: string; role: "admin" | "empleado"; active: boolean; linkCode: string | null; telegramChatId: number | null };

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${ok ? "bg-ok" : "bg-warn"}`} />
      <span>{children}</span>
    </div>
  );
}

export default function ConfigPage() {
  const me = useUser();
  const { data: s, reload: reloadSettings } = useApi<SettingsResp>("/api/settings");
  const { data: users, reload: reloadUsers } = useApi<U[]>(me?.role === "admin" ? "/api/users" : null);
  const [draft, setTpl] = useState<SettingsResp["settings"] | null>(null);
  const tpl = draft ?? s?.settings ?? null;
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<{ id?: number; username: string; name: string; role: U["role"]; password: string } | null>(null);

  if (me?.role !== "admin") return <ErrorBox>Solo el administrador puede ver esta sección.</ErrorBox>;
  if (!s || !tpl || !users) return <Loading />;

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const preview = tpl.ready_template
    .replaceAll("{nombre}", "Ana")
    .replaceAll("{ticket}", "#00012")
    .replaceAll("{negocio}", tpl.business_name)
    .replaceAll("{total}", "$40.000")
    .replaceAll("{saldo}", "Saldo a abonar: $20.000.");

  return (
    <>
      <PageHeader title="Configuración" subtitle="Usuarios, mensajes e integraciones" />
      {msg && <p className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">{msg}</p>}
      <div className="mb-4">
        <ErrorBox>{err}</ErrorBox>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Usuarios ({users.length})</h2>
            <Button variant="secondary" onClick={() => setUserForm({ username: "", name: "", role: "empleado", password: "" })}>
              + Usuario
            </Button>
          </div>
          <div className="divide-y divide-line">
            {users.map((u) => (
              <div key={u.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${u.active ? "" : "opacity-50"}`}>
                <div>
                  <p className="font-medium">
                    {u.name} <span className="text-sm font-normal text-muted">@{u.username} · {u.role}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {u.telegramChatId ? (
                      <span className="text-ok">✓ Telegram vinculado</span>
                    ) : u.linkCode ? (
                      <>
                        Mandale al bot: <code className="rounded bg-brand-soft px-1.5 py-0.5 font-mono text-brand-strong">/vincular {u.linkCode}</code>
                      </>
                    ) : (
                      "Telegram sin vincular"
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!u.telegramChatId && (
                    <Button variant="ghost" className="min-h-9" loading={busy === `code${u.id}`} onClick={() => run(`code${u.id}`, async () => { await api(`/api/users/${u.id}`, { method: "PATCH", json: { newLinkCode: true } }); reloadUsers(); })}>
                      Código Telegram
                    </Button>
                  )}
                  {u.telegramChatId && (
                    <Button variant="ghost" className="min-h-9" onClick={() => run(`un${u.id}`, async () => { await api(`/api/users/${u.id}`, { method: "PATCH", json: { unlinkTelegram: true } }); reloadUsers(); })}>
                      Desvincular
                    </Button>
                  )}
                  <Button variant="ghost" className="min-h-9" onClick={() => setUserForm({ id: u.id, username: u.username, name: u.name, role: u.role, password: "" })}>
                    Editar
                  </Button>
                  {u.id !== me.id && (
                    <Button variant="ghost" className="min-h-9" onClick={() => run(`act${u.id}`, async () => { await api(`/api/users/${u.id}`, { method: "PATCH", json: { active: !u.active } }); reloadUsers(); })}>
                      {u.active ? "Desactivar" : "Activar"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Mensaje de «ropa lista»</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del negocio">
              <input className={inputCls} value={tpl.business_name} onChange={(e) => setTpl({ ...tpl, business_name: e.target.value })} />
            </Field>
            <Field label="Teléfono">
              <input className={inputCls} value={tpl.business_phone} onChange={(e) => setTpl({ ...tpl, business_phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Texto" hint="Variables: {nombre} {ticket} {negocio} {total} {saldo}">
            <textarea className={`${inputCls} min-h-32 py-2`} value={tpl.ready_template} onChange={(e) => setTpl({ ...tpl, ready_template: e.target.value })} />
          </Field>
          <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] px-3 py-2 text-sm whitespace-pre-wrap text-[#111]">{preview}</div>
          <Button loading={busy === "tpl"} onClick={() => run("tpl", () => api("/api/settings", { method: "PUT", json: tpl }), "Mensaje guardado ✓")}>
            Guardar mensaje
          </Button>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Integraciones</h2>
          <Status ok={s.integrations.telegram}>
            <b>Telegram</b>:{" "}
            {s.integrations.telegram ? (
              <>
                conectado como{" "}
                <a className="text-brand underline" href={`https://t.me/${s.integrations.botUsername}`} target="_blank" rel="noopener noreferrer">
                  @{s.integrations.botUsername}
                </a>
              </>
            ) : (
              "falta TELEGRAM_BOT_TOKEN"
            )}
          </Status>
          <Status ok={s.integrations.ai}>
            <b>IA (audios e interpretación)</b>: {s.integrations.ai ? s.integrations.aiProvider : "sin API key — se usa interpretación por reglas y no se aceptan audios"}
          </Status>
          <Status ok={false}>
            <b>WhatsApp automático</b>: pendiente de aprobación del presupuesto. Mientras tanto se usa el botón «Enviar por WhatsApp» (gratis).
          </Status>
          {s.integrations.telegram && (
            <Button
              variant="secondary"
              loading={busy === "hook"}
              onClick={() =>
                run("hook", async () => {
                  const r = await api<{ url: string }>("/api/telegram/setup", { method: "POST" });
                  setMsg(`Webhook registrado en ${r.url} ✓`);
                  reloadSettings();
                })
              }
            >
              Conectar bot a este servidor
            </Button>
          )}
        </Card>
      </div>

      <Modal open={!!userForm} onClose={() => setUserForm(null)} title={userForm?.id ? "Editar usuario" : "Nuevo usuario"}>
        {userForm && (
          <div className="space-y-3">
            {!userForm.id && (
              <Field label="Usuario (para ingresar)">
                <input className={inputCls} autoCapitalize="none" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
              </Field>
            )}
            <Field label="Nombre">
              <input className={inputCls} value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            </Field>
            <Field label="Rol">
              <select className={inputCls} value={userForm.role} disabled={userForm.id === me.id} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as U["role"] })}>
                <option value="empleado">Empleado</option>
                <option value="admin">Administrador</option>
              </select>
            </Field>
            <Field label={userForm.id ? "Nueva contraseña (opcional)" : "Contraseña"} hint="Mínimo 8 caracteres">
              <input className={inputCls} type="password" autoComplete="new-password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            </Field>
            <ErrorBox>{err}</ErrorBox>
            <Button
              className="w-full"
              loading={busy === "user"}
              onClick={() =>
                run("user", async () => {
                  const { id, password, username, ...rest } = userForm;
                  if (id) await api(`/api/users/${id}`, { method: "PATCH", json: { ...rest, ...(password ? { password } : {}) } });
                  else await api("/api/users", { method: "POST", json: { ...rest, username, password } });
                  setUserForm(null);
                  reloadUsers();
                })
              }
            >
              Guardar
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
