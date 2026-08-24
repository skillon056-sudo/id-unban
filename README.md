# Free Fire ID Recovery & Unban Portal

A full-stack **Next.js 14 (App Router) + TypeScript + Tailwind + Prisma** portal to
look up Free Fire ID ban status and submit verified unban requests through a
swappable payment gateway (Sunpay-ready).

> **Reference website:** set `NEXT_PUBLIC_REFERENCE_URL` in `.env`. It is used for
> visual direction only and is **not** referenced at runtime.

---

## Features

- Public ID lookup (`BANNED` / `UNBANNED` / `PENDING`) with ban reason
- Unban flow → payment → **server-verified** success/failure/pending pages
- Secure `/admin` dashboard (JWT httpOnly cookie): stats, ID CRUD, unban requests, payments, settings
- Payment gateway **abstraction** — mock gateway works out of the box; Sunpay is a
  clearly-marked stub (`src/services/payment/sunpay.ts`)
- Rate limiting, input validation (Zod), SQL-injection-safe (Prisma), secure headers, CSRF origin checks

---

## 1. Installation

```bash
npm install
```

## 2. Environment variables

```bash
cp .env.example .env
```

Then edit `.env`. Key values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | DB connection (SQLite default: `file:./dev.db`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap admin account (used by seed) |
| `SESSION_SECRET` | **Required.** Long random string for signing sessions |
| `NEXT_PUBLIC_SITE_NAME` | Site branding |
| `NEXT_PUBLIC_BASE_URL` | Public base URL (used to build payment redirect URLs) |
| `PAYMENT_GATEWAY` | `mock` (default) or `sunpay` |
| `UNBAN_PRICE` / `PAYMENT_CURRENCY` | Default unban fee + currency |
| `SUNPAY_*` | Sunpay credentials (leave blank until provided) |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Database setup

```bash
npm run setup
```

This runs `prisma generate`, `prisma db push` (creates the schema) and seeds an
admin plus fictional test IDs (`100000001`–`100000005`).

Individual commands: `npm run db:push`, `npm run db:seed`, `npm run db:studio`.

## 4. Development

```bash
npm run dev
```

Open http://localhost:3000. Admin: http://localhost:3000/admin (log in with
`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

**Try the flow:** search `100000001` → **Unban ID** → mock checkout → *Pay now* →
you land on the server-verified success page.

## 5. Production build

```bash
npm run build
npm start
```

## 6. Admin account setup

The admin is created/updated by the seed from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
To change credentials: update `.env`, then re-run `npm run db:seed` (it upserts
and re-hashes the password). Passwords are stored as bcrypt hashes only.

---

## 7. Where to add Sunpay credentials / API details

1. **Credentials** → `.env` (`SUNPAY_API_URL`, `SUNPAY_MERCHANT_ID`,
   `SUNPAY_API_KEY`, `SUNPAY_SECRET_KEY`, and the `SUNPAY_*_URL` values).
2. **Code** → `src/services/payment/sunpay.ts`. Three methods are stubbed with
   `TODO(sunpay)` blocks describing exactly what to implement from the official docs:
   - `createOrder()` — create the payment and return the hosted-checkout redirect URL
   - `handleWebhook()` — verify the signature, normalize status → `PaymentState`
   - `verifyPayment()` — server-to-server status poll (fallback for delayed webhooks)
3. **Switch it on** → set `PAYMENT_GATEWAY=sunpay` in `.env`.

Nothing else changes: the frontend, API routes, order lifecycle, and settlement
logic (`src/services/payment/settle.ts`) all depend only on the
`PaymentGateway` interface (`src/services/payment/gateway.ts`).

> Payments are **only** marked successful after server-side verification in
> `settlePayment()` — a browser redirect to a success URL never settles a payment.
> The webhook endpoint is `POST /api/payment/webhook`; point Sunpay's webhook there.

---

## 8. Switching to PostgreSQL

1. In `prisma/schema.prisma`, change `provider = "sqlite"` → `provider = "postgresql"`.
2. Set `DATABASE_URL` to your Postgres connection string.
3. Run `npm run db:push && npm run db:seed`.

Statuses are stored as strings (validated in the app layer), so no enum migration
is required.

## 9. Deployment

- **Vercel** (recommended for Next.js): import the repo, set all `.env` values as
  project env vars (use a hosted Postgres such as Neon/Supabase for
  `DATABASE_URL`), and set `NEXT_PUBLIC_BASE_URL` + `SUNPAY_*_URL` to your
  production domain. Build command `npm run build`.
- **Any Node host**: `npm run build` then `npm start` behind HTTPS. Ensure
  `SESSION_SECRET` is set and `NODE_ENV=production` (enables the `Secure` cookie flag).
- Run `npm run db:push` (or `prisma migrate deploy` if you add migrations) against
  the production database before first start.

---

## Project structure

```
prisma/                 schema + seed
src/
  app/                  pages + API routes (App Router)
    api/                REST endpoints (public + /admin)
    admin/              protected dashboard pages
    payment/            success / failed / pending / mock checkout
  components/           UI + admin components
  lib/                  db, auth, validation, rate-limit, settings, utils, types
  services/payment/     gateway interface, mock, sunpay stub, settlement
  middleware.ts         admin auth guard + security headers
```

## API endpoints

Public: `GET /api/id/:gameId` · `POST /api/payment/create` ·
`GET /api/payment/status/:orderId` · `POST /api/payment/webhook`

Admin (auth required): `POST /api/admin/login` · `POST /api/admin/logout` ·
`GET|POST /api/admin/ids` · `PUT|DELETE /api/admin/ids/:id` ·
`GET /api/admin/unban-requests` · `GET /api/admin/payments` ·
`GET /api/admin/stats` · `GET|PUT /api/admin/settings`

---

**Disclaimer:** This is an independent fan-made support portal, not affiliated
with or endorsed by Garena or Free Fire. Test IDs are fictional.
