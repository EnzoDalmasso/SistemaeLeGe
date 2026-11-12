# eLeGe · Sistema de gestión para lavaderos

Sistema web hecho a medida para un lavadero de ropa del interior de Santa Fe. Antes de esto, el negocio trabajaba con un talón de papel por cada pedido, un cuaderno como historial y una lista de precios impresa en la pared. eLeGe reemplaza esas tres cosas por un panel que se usa desde la computadora del mostrador o desde el celular.

**Demo:** [sistemaelege.vercel.app](https://sistemaelege.vercel.app)

## Qué problema resuelve

En el día a día del lavadero, cada pedido pasaba por varias manos y varios papeles:

- Al recibir la ropa se escribía un talón a mano: una copia para el cliente y otra para el lavadero.
- El historial de cada cliente quedaba en un cuaderno, difícil de consultar cuando alguien preguntaba por un pedido viejo.
- El importe se calculaba mirando la lista de precios. Algunos servicios tienen rango de precio o cobro mínimo por kilo, así que era fácil equivocarse.
- Las señas y los pagos al retirar se anotaban por separado y no siempre se sabía cuánto debía cada cliente.
- Para avisar que la ropa estaba lista había que acordarse de llamar o escribir a cada cliente.

eLeGe centraliza todo eso: el pedido se carga una sola vez y a partir de ahí el sistema calcula el importe, guarda el historial, lleva la cuenta de lo pagado y prepara el aviso al cliente.

## Funcionalidades

### Órdenes de trabajo

- Alta de órdenes con cliente, prendas, cantidades, observaciones y seña.
- Estados: **recibida → lavando → lista → entregada**, y también **cancelada**.
- La seña es obligatoria: no se puede crear una orden sin seña o sin indicar que el cliente pagó todo. La seña no puede superar el importe.
- Al entregar, el sistema cobra solo el saldo pendiente. Si la orden ya estaba pagada, no deja cobrar de nuevo.
- Búsqueda por nombre, teléfono o número de orden, y filtros por estado.

### Talón

Cada orden tiene un talón imprimible con dos mitades, una para el cliente y otra para el lavadero, igual que el de papel. La copia del cliente incluye un código QR para que reciba el aviso de "ropa lista" por Telegram.

### Precios

El administrador carga y edita la lista de precios desde el panel. Cada servicio puede cobrarse:

- **Por unidad**, con un precio fijo o con un rango (por ejemplo, acolchado de 1 plaza entre $15.000 y $17.000). Se usa el mínimo, salvo que se indique otro valor.
- **Por kilo**, con un cobro mínimo hasta cierta cantidad de kilos (por ejemplo, ropa por kg con mínimo de $12.000 hasta 3 kg).

También se pueden cargar prendas que no están en la lista, con un precio puntual.

### Clientes e historial

- Ficha de cada cliente con teléfono, notas y todas sus órdenes. El administrador puede eliminar un cliente junto con sus órdenes.
- Los teléfonos se normalizan: `03471 15 687792`, `+54 9 3471 687792` y `3471-687792` se guardan igual.
- Al cargar una orden, el sistema busca si el cliente ya existe por teléfono o por cómo suena el nombre. Así "Dalmazo" encuentra a "Dalmasso" y no se duplican clientes.

### Panel de inicio

- Cobrado en el día y en el mes (seña al dejar más pago al retirar).
- Gráfico de cobros de los últimos 14 días.
- Órdenes en proceso, listas para retirar y últimos ingresos.
- Avisos de órdenes listas sin avisar al cliente, y de órdenes que superaron los 30 días desde el primer aviso.

### Usuarios y configuración

- Dos roles: **administrador** y **empleado**. Solo el administrador gestiona precios, usuarios, configuración y la conexión del bot.
- Alta, edición y desactivación de usuarios. Un usuario desactivado pierde el acceso en el momento.
- Texto del mensaje de "ropa lista" editable, con las variables `{nombre}`, `{ticket}`, `{negocio}`, `{total}` y `{saldo}`.
- Código de vinculación de Telegram para cada usuario.

## Carga de órdenes por mensaje o audio

Es la parte que más tiempo le ahorra al personal. En lugar de completar el formulario campo por campo, el empleado escribe o dicta el pedido como lo diría en voz alta:

> María López, 3471 555123, un acolchado de dos plazas y cuatro kilos de ropa. Deja diez mil pesos de seña.

El sistema extrae el cliente, el teléfono, las prendas y su cantidad, y la seña. Con eso arma una propuesta de orden con el importe calculado. Si el cliente ya existe, lo muestra como "cliente existente". La orden no se guarda hasta que alguien la confirma.

Esto funciona desde el panel, con el botón de dictado de "Nueva orden", y desde el bot de Telegram.

### Reglas propias e IA

La interpretación tiene dos motores:

- **Reglas propias** (`src/lib/parser.ts`): un intérprete escrito a mano que reconoce teléfonos, montos ("10 mil", "10.000"), cantidades en palabras, medidas como "dos plazas" o "plaza y media", abreviaturas del cuaderno ("1 ac 2p") y frases como "paga todo". Funciona sin ninguna API externa.
- **IA** (`src/lib/ai.ts`): si hay una API key configurada, un modelo de lenguaje interpreta el mensaje y devuelve un JSON. Lo que la IA deja vacío se completa con el resultado de las reglas, así que las dos partes se complementan.

Los **audios** siempre necesitan IA. Se transcriben con Whisper, y para que los nombres salgan bien escritos se le pasa como pista la lista de precios y los nombres de los últimos clientes. Sin API key, el sistema interpreta solo mensajes escritos.

## Bot de Telegram

La demo usa Telegram como canal de mensajería porque es gratis y no requiere aprobación previa.

**Vinculación del personal.** Cada usuario tiene un código de 6 dígitos en Configuración. Lo manda al bot con `/vincular 123456` y desde ese momento el bot lo reconoce.

**Carga de órdenes.** El empleado manda un texto o un audio. El bot muestra la transcripción, si es audio, y un resumen con prendas, importe, seña y saldo, junto con los botones **Confirmar** y **Cancelar**. Si falta el nombre, las prendas o la seña, avisa qué falta y no ofrece confirmar.

**Cambios de estado en lenguaje natural.** Frases como "la orden 12 está lista" o "la orden 12 la retiró y pagó 15 mil" también se entienden.

**Comandos disponibles:**

| Comando | Qué hace |
|---|---|
| `/vincular 123456` | Vincula el chat con un usuario del sistema |
| `/pendientes` | Órdenes listas que todavía no se retiraron |
| `/buscar nombre` | Últimas órdenes de un cliente, por nombre o teléfono |
| `/listo 12` | Marca la orden como lista y avisa al cliente |
| `/entregado 12` | Marca la orden como retirada y cobra el saldo |
| `/ayuda` | Explica cómo usar el bot |

**Aviso al cliente.** Al confirmar una orden, el bot genera un mensaje con un link para reenviarle al cliente. Si el cliente lo abre y toca «Iniciar», queda vinculado. Cuando la orden pasa a "lista", desde el panel o desde el bot, recibe el aviso automáticamente. Si el cliente no está vinculado, el aviso queda pendiente y el bot le avisa al personal vinculado para que lo mande por WhatsApp desde el panel.

El webhook valida el secreto que envía Telegram y procesa cada mensaje una sola vez, aunque Telegram lo reintente.

## WhatsApp

Estado actual:

- **Implementado:** en la ficha de cada orden hay un botón que abre WhatsApp con el mensaje de "ropa lista" ya escrito, dirigido al teléfono del cliente. El envío lo hace la persona desde su propio WhatsApp.
- **No implementado:** la integración con la API oficial de WhatsApp Business (Meta). El código deja preparado el punto de extensión: los canales de aviso se definen en `src/lib/messaging.ts` con una interfaz común, y la lógica del bot en `src/lib/bot.ts` no depende de Telegram más allá del cliente HTTP. Agregar WhatsApp implicaría un nuevo canal y un webhook de entrada.

## Tecnologías

| Área | Herramienta |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS 4 |
| Base de datos | PostgreSQL con Drizzle ORM y el driver `postgres` |
| Autenticación | Sesiones con JWT firmado (`jose`) en cookie httpOnly; contraseñas con `bcryptjs` |
| Validación | Zod |
| IA | Cualquier API compatible con OpenAI. En la demo, Groq con `whisper-large-v3` para audio y `llama-3.3-70b-versatile` para texto |
| Mensajería | Bot API de Telegram, con un cliente propio sin dependencias |
| Códigos QR | `qrcode` |
| Tests | Vitest |
| Hosting de la demo | Vercel + Neon (PostgreSQL) |

## Organización del código

```
src/
├── app/
│   ├── (app)/        Páginas del panel: inicio, órdenes, clientes, precios, configuración
│   ├── api/          Endpoints REST del panel, webhook y configuración del bot
│   ├── login/        Pantalla de ingreso
│   └── talon/        Talón imprimible de cada orden
├── components/       Componentes de interfaz: layout, botones, QR, dictado por voz
├── lib/
│   ├── db/           Conexión y esquema de la base de datos
│   ├── orders.ts     Alta de órdenes, cambios de estado, búsqueda de clientes, aviso de "lista"
│   ├── pricing.ts    Cálculo de importes y validación de la seña
│   ├── parser.ts     Intérprete de mensajes por reglas
│   ├── ai.ts         Transcripción e interpretación con IA
│   ├── bot.ts        Lógica del bot, independiente del canal
│   ├── telegram.ts   Cliente de la Bot API de Telegram
│   ├── messaging.ts  Canales de aviso al cliente
│   └── auth.ts       Sesiones
└── proxy.ts          Redirige al login si no hay sesión

scripts/              Carga inicial, datos de demostración y bot en modo local
drizzle/              Migraciones SQL generadas por Drizzle Kit
```

Las páginas del panel no acceden a la base directamente: consumen la API de `src/app/api`. Cada endpoint pasa por un mismo envoltorio (`src/lib/api.ts`) que exige sesión, controla el rol de administrador cuando hace falta y devuelve los errores en JSON.

### Modelo de datos

| Tabla | Contenido |
|---|---|
| `users` | Usuarios del panel, rol y chat de Telegram vinculado |
| `clients` | Clientes, teléfono, notas y token para vincular su Telegram |
| `orders` | Órdenes: estado, importe, seña, pago al retirar y fechas de cada etapa |
| `order_items` | Prendas de cada orden con cantidad, precio unitario y subtotal |
| `price_items` | Lista de precios: unidad o kilo, rango y cobro mínimo |
| `notifications` | Registro de cada aviso enviado o pendiente |
| `bot_drafts` | Órdenes propuestas por el bot que esperan confirmación |
| `telegram_updates` | Mensajes ya procesados, para no duplicarlos |
| `settings` | Nombre del negocio y texto del aviso |

Una orden pertenece a un cliente y tiene varias prendas. Cada prenda puede apuntar a un precio de la lista o ser una prenda suelta con precio propio.

## Instalación local

### Requisitos

- Node.js 20.9 o superior.
- PostgreSQL. El ejemplo de abajo usa Docker, pero sirve cualquier instancia.

### Pasos

```bash
git clone https://github.com/EnzoDalmasso/SistemaeLeGe.git
cd SistemaeLeGe
npm install
```

Levantar PostgreSQL con Docker:

```bash
docker run -d --name elege-pg -e POSTGRES_USER=elege -e POSTGRES_PASSWORD=elege -e POSTGRES_DB=elege -p 54329:5432 postgres:17-alpine
```

Crear el archivo de variables de entorno:

```bash
cp .env.example .env.local
```

En `.env.local`, apuntar `DATABASE_URL` a la base local y completar `AUTH_SECRET` y `SEED_PASSWORD`:

```env
DATABASE_URL=postgres://elege:elege@localhost:54329/elege
AUTH_SECRET=...        # al menos 32 caracteres
SEED_PASSWORD=...      # al menos 8 caracteres
```

Para generar `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Crear las tablas, cargar los datos iniciales e iniciar el servidor:

```bash
npm run db:migrate     # crea las tablas
npm run db:seed        # lista de precios inicial y usuarios
npm run db:demo        # opcional: órdenes de ejemplo con clientes inventados
npm run dev            # http://localhost:3000
```

`db:seed` crea los usuarios `admin`, `empleado1`, `empleado2` y `empleado3`, todos con la contraseña definida en `SEED_PASSWORD`. Se pueden cambiar después desde Configuración. El script no pisa datos existentes: se puede correr más de una vez.

### Variables de entorno

| Variable | Obligatoria | Para qué sirve |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a PostgreSQL. En Neon, usar la URL *pooled* |
| `AUTH_SECRET` | Sí | Clave para firmar las sesiones (mínimo 32 caracteres) |
| `SEED_PASSWORD` | Sí, para `db:seed` | Contraseña inicial de los usuarios |
| `TELEGRAM_BOT_TOKEN` | Para el bot | Token que entrega @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Para el bot en producción | Secreto con el que Telegram firma cada llamada al webhook |
| `AI_BASE_URL` | Para IA | URL de una API compatible con OpenAI |
| `AI_API_KEY` | Para IA | Sin esta clave se usan solo las reglas y no se aceptan audios |
| `AI_TEXT_MODEL` | Para IA | Modelo para interpretar mensajes |
| `AI_AUDIO_MODEL` | Para IA | Modelo de transcripción |

`.env.example` trae los valores de Groq para la demo y los de OpenAI como alternativa.

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run lint` | ESLint |
| `npm test` | Tests de precios, teléfonos, nombres e intérprete de mensajes |
| `npm run db:generate` | Genera una migración nueva a partir de cambios en el esquema |
| `npm run db:migrate` | Aplica las migraciones |
| `npm run db:seed` | Carga precios iniciales y usuarios |
| `npm run db:demo` | Agrega órdenes de ejemplo. No usar en producción |
| `npm run bot:poll` | Corre el bot de Telegram en local, sin webhook ni HTTPS |
| `npm run bot:simulate` | Simula una conversación con el bot sin Telegram real, contra la base local |

### Probar el bot en local

Con `TELEGRAM_BOT_TOKEN` en `.env.local`:

```bash
npm run bot:poll
```

El script desactiva el webhook y queda escuchando mensajes nuevos con *long polling*. Si el mismo bot está conectado a un deploy, después hay que volver a registrar el webhook desde Configuración.

Para probar la lógica sin un bot real, `npm run bot:simulate` intercepta las llamadas a Telegram y muestra en consola lo que el bot respondería. Modifica datos, así que solo debe usarse contra la base local.

## Despliegue en Vercel

1. Importar el repositorio en [Vercel](https://vercel.com).
2. En **Storage**, crear una base **Neon (Postgres)**. Vercel agrega `DATABASE_URL` automáticamente.
3. En **Settings → Environment Variables**, cargar `AUTH_SECRET`, `SEED_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` y las variables `AI_*`.
4. Desplegar. El script `vercel-build` aplica las migraciones, corre el seed y compila. El seed no pisa datos, así que es seguro en cada deploy.
5. Ingresar como administrador y, en Configuración, usar **Conectar bot a este servidor**. Eso registra el webhook de Telegram con la URL del deploy y carga la lista de comandos.

### Demo y producción

La demo funciona con planes gratuitos: Vercel Hobby, Neon Free y Groq. Para un uso real del negocio hay que tener en cuenta:

- El plan Hobby de Vercel es para uso personal y no comercial. En producción corresponde un plan pago o un hosting que permita uso comercial.
- Las cuentas de hosting, base de datos e IA deberían quedar a nombre del negocio.
- `db:demo` no debe correrse en producción, y las contraseñas iniciales deben cambiarse desde Configuración.

## Tests

```bash
npm test
```

Los tests cubren la lógica que más errores puede causar en el mostrador: cálculo de precios (rangos, cobro mínimo por kilo), validación de la seña, normalización de teléfonos, comparación de nombres por sonido e interpretación de mensajes escritos de distintas formas, incluidos textos que imitan transcripciones de audio.
