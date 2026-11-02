# eLeGe · Sistema del lavadero

Reemplaza el papel del Lavadero eLeGe: talón del cliente, cuaderno de historial y lista de precios.

- **Panel web** (PC y celulares): órdenes, clientes con su historial, precios, cobros del día/mes, talón imprimible.
- **Carga por mensaje o audio**: el personal escribe o graba "Ana Pérez, 3471 555123, un acolchado de 2 plazas y 4 kilos de ropa, deja 10 mil de seña" y el sistema arma la orden (desde el panel o por el bot).
- **Aviso automático "ropa lista"** al cliente cuando la orden se marca como lista.
- **Demo**: el canal de mensajes es **Telegram** (gratis). WhatsApp queda preparado para cuando se apruebe el presupuesto; mientras tanto el panel tiene un botón "Enviar por WhatsApp" que abre el chat con el mensaje escrito.

Stack: Next.js 16 + TypeScript + Tailwind, PostgreSQL (Drizzle ORM), IA compatible con OpenAI (Groq gratis en la demo).

## Correr en local

Requisitos: Node 20+, Docker.

```bash
docker run -d --name elege-pg -e POSTGRES_PASSWORD=elege -e POSTGRES_USER=elege -e POSTGRES_DB=elege -p 54329:5432 postgres:17-alpine
cp .env.example .env.local   # completar AUTH_SECRET y SEED_PASSWORD
npm install
npm run db:migrate           # crea las tablas
npm run db:seed              # precios del cartel + usuarios admin, empleado1..3
npm run db:demo              # (opcional) órdenes de ejemplo para presentar
npm run dev                  # http://localhost:3000
```

Usuarios: `admin`, `empleado1`, `empleado2`, `empleado3`, todos con la contraseña `SEED_PASSWORD`. Cambiarlas desde Configuración.

| Script | Para qué |
|---|---|
| `npm test` | Tests de precios, teléfonos y del intérprete de mensajes |
| `npm run bot:poll` | Bot de Telegram en local (sin HTTPS ni webhook) |
| `npm run bot:simulate` | Simula una conversación con el bot sin Telegram real (base local) |

## Bot de Telegram

1. En Telegram, hablar con **@BotFather** → `/newbot` → copiar el token a `TELEGRAM_BOT_TOKEN`.
2. Cada empleado: en el panel → Configuración → "Código Telegram", y le manda al bot `/vincular 123456`.
3. El personal manda texto o audio con la orden → el bot muestra el resumen con **Confirmar / Cancelar**.
4. Al confirmar, el bot devuelve un link para el cliente. Si el cliente lo abre, recibe el aviso automático cuando su ropa esté lista.
5. "La orden 12 está lista" (o `/listo 12`) → se avisa al cliente. `/pendientes`, `/buscar nombre`, `/entregado 12`.

## IA (audios)

`AI_BASE_URL`, `AI_API_KEY`, `AI_TEXT_MODEL`, `AI_AUDIO_MODEL`. Cualquier API compatible con OpenAI:

- Demo gratis: [Groq](https://console.groq.com) → crear API key (Whisper para audio, Llama para interpretar).
- Producción: OpenAI (`https://api.openai.com/v1`, `gpt-4o-mini` + `gpt-4o-mini-transcribe`).

Sin API key el sistema igual funciona: interpreta mensajes escritos con reglas y no acepta audios.

## Publicar la demo en Vercel (gratis)

1. Subir esta carpeta (`web/`) a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New Project** → importar el repo.
3. En el proyecto → **Storage** → **Neon (Postgres)** → crear base gratis. Vercel agrega `DATABASE_URL` sola.
4. En **Settings → Environment Variables** cargar `AUTH_SECRET`, `SEED_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `AI_*`.
5. Deploy. El script `vercel-build` crea/actualiza las tablas y carga precios y usuarios en cada deploy (sin pisar datos existentes).
6. Entrar como admin → Configuración → **Conectar bot a este servidor** (registra el webhook de Telegram).

## Pasar a producción (cuando aprueben)

Solo cambian variables de entorno y cuentas; el código es el mismo:

- **Cuentas a nombre del lavadero**: Vercel, Neon, OpenAI/Groq y la cuenta de Meta Business.
- **WhatsApp**: implementar `WhatsAppCloudChannel` en `src/lib/messaging.ts` (API oficial de Meta, plantilla "ropa lista" aprobada) y un webhook de entrada igual al de Telegram (`src/lib/bot.ts` ya separa la lógica del canal).
- **Datos**: cargar sus precios reales desde el panel y, si quieren, importar el cuaderno actual.

## Estructura

```
src/lib/db/schema.ts    tablas: users, clients, orders, order_items, price_items, notifications, settings
src/lib/orders.ts       crear órdenes, cambiar estado, aviso de "lista"
src/lib/pricing.ts      cálculo de precios (rango, por kg con mínimo)
src/lib/parser.ts       intérprete por reglas (sin IA)   ·   src/lib/ai.ts  transcripción + IA
src/lib/bot.ts          lógica del bot   ·   src/lib/messaging.ts  canales de aviso al cliente
src/app/(app)/          páginas del panel   ·   src/app/api/  API
```
