// Utilidades sin dependencias de servidor: se usan tanto en el panel como en el backend.

export const STATUS_LABELS = {
  recibido: "Recibido",
  lavando: "Lavando",
  listo: "Listo p/ retirar",
  entregado: "Entregado",
  cancelado: "Cancelado",
} as const;

export function money(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

export function ticket(id: number) {
  return "#" + String(id).padStart(5, "0");
}

const TZ = "America/Argentina/Buenos_Aires";

export function fmtDate(d: string | Date | null | undefined, withTime = false) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: withTime ? undefined : "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** Argentina no tiene horario de verano: el día empieza a las 03:00 UTC. */
export function arDayStart(d = new Date()) {
  const offset = 3 * 3600_000;
  const day = 86400_000;
  return new Date(Math.floor((d.getTime() - offset) / day) * day + offset);
}

/** Texto de una prenda: "2 × Campera"; en las de kilo la cantidad ya va en la descripción. */
export function itemLabel(i: { quantity: number; description: string }) {
  return i.quantity !== 1 && !/ kg\b/.test(i.description) ? `${i.quantity} × ${i.description}` : i.description;
}

export function balance(o: { total: number; deposit: number; paidOnPickup: number }) {
  return o.total - o.deposit - o.paidOnPickup;
}

/** ¿Es la misma persona? Compara el nombre de pila sin acentos ("Enzo Dalmazo" ≈ "enzo dalmasso"). */
export function sameName(a: string | null | undefined, b: string | null | undefined) {
  const first = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().split(/\s+/)[0];
  return Boolean(a?.trim() && b?.trim()) && first(a!) === first(b!);
}

/** Clave "como suena": Dalmazo = Dalmasso, Gonzalez = González, Bazquez = Vázquez. */
export function nameKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ\s]/g, "")
    .replace(/c(?=[ei])|z/g, "s")
    .replace(/v/g, "b")
    .replace(/ll/g, "y")
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza teléfonos argentinos a solo dígitos, sin 0 ni 15 (ej: 03471-15687792 → 3471687792). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  // Quita el "15" de celular que va después del código de área (2 a 4 dígitos).
  if (d.length === 12) {
    for (const areaLen of [4, 3, 2]) {
      if (d.slice(areaLen, areaLen + 2) === "15") {
        d = d.slice(0, areaLen) + d.slice(areaLen + 2);
        break;
      }
    }
  }
  return d.length >= 6 ? d : null;
}

/** Link de WhatsApp "click to chat" (gratis): abre el chat con el mensaje ya escrito. */
export function whatsappLink(phone: string | null, text: string) {
  const p = normalizePhone(phone);
  const base = p && p.length === 10 ? `https://wa.me/549${p}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
