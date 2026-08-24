# Deploy to Vercel

This app is serverless-ready. Two host facts to know first:

- **Database:** SQLite can't run on Vercel. Use a hosted **PostgreSQL** (Neon free tier is easiest). The schema is already set to `postgresql`.
- **Image uploads:** Vercel's filesystem is read-only, so the "Upload" button in Admin → Appearance won't persist there. **Paste image URLs** instead (or add Vercel Blob later). All other features work fully.

---

## 1. Create a Postgres database (Neon — free, ~2 min)

1. Go to https://neon.tech → sign up → **Create project**.
2. Copy the **connection string** (looks like
   `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`).

## 2. Push the schema + seed into that database (run locally, once)

In the project folder, temporarily point at the Neon URL and run:

```bash
npx cross-env DATABASE_URL="YOUR_NEON_URL" npx prisma db push
npx cross-env DATABASE_URL="YOUR_NEON_URL" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="StrongPass123!" npm run db:seed
```

(Windows PowerShell alternative, no cross-env needed:)

```powershell
$env:DATABASE_URL="YOUR_NEON_URL"; npx prisma db push; npm run db:seed
```

This creates the tables, your admin account, settings, and the demo IDs.

## 3. Put the code on GitHub

```bash
git init
git add .
git commit -m "FF unban portal"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

> `.env` is gitignored — your Sunpay secrets are **not** pushed. You'll set them
> in Vercel (next step).

## 4. Import into Vercel

1. https://vercel.com → **Add New → Project** → import your GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Build command stays
   `npm run build` (it runs `prisma generate` first — already configured).
3. **Environment Variables** — add these (Production + Preview):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `SESSION_SECRET` | a long random string (`openssl rand -hex 48`) |
   | `ADMIN_EMAIL` | your admin email |
   | `ADMIN_PASSWORD` | your admin password |
   | `NEXT_PUBLIC_SITE_NAME` | e.g. `Rebooter — FF ID Recovery` |
   | `NEXT_PUBLIC_BASE_URL` | `https://YOUR-APP.vercel.app` (see step 6) |
   | `PAYMENT_GATEWAY` | `sunpay` |
   | `UNBAN_PRICE` | `199` |
   | `PAYMENT_CURRENCY` | `INR` |
   | `SUNPAY_BASE_URL` | `https://sunpaytm.quest` |
   | `SUNPAY_ENABLED` | `true` |
   | `SUNPAY_METHOD` | `upi` |
   | `SUNPAY_PAYIN_PATH` | `/api/public/v1/payins` |
   | `SUNPAY_MIN_AMOUNT` | `100` |
   | `SUNPAY_PAYIN_API_KEY` | *(from your Sunpay dashboard)* |
   | `SUNPAY_PAYIN_API_SECRET` | *(from your Sunpay dashboard)* |
   | `SUNPAY_WEBHOOK_SECRET` | *(from your Sunpay dashboard)* |

4. Click **Deploy**.

## 5. Set the real domain and redeploy

After the first deploy Vercel gives you `https://YOUR-APP.vercel.app`.
Set that as `NEXT_PUBLIC_BASE_URL` (step 4 table) and **redeploy** — this value
builds Sunpay's `notify_url` and `redirect_url`, so it must be the live URL.

## 6. Register the Sunpay webhook

In the Sunpay dashboard set the pay-in webhook / notify URL to:

```
https://YOUR-APP.vercel.app/api/payment/webhook
```

(The app also sends this as `notify_url` on every payment, so both paths agree.)

---

## Verify after deploy

- Home → search `100000001` → **Unban ID** → you should be redirected to Sunpay's
  UPI checkout.
- After a real payment, Sunpay calls the webhook → the payment is verified
  server-side (HMAC over the raw body) → the request is marked SUBMITTED and the
  ID moves to PENDING. Check **Admin → Payments / Unban Requests**.
- Admin login: `https://YOUR-APP.vercel.app/admin`.

## Notes / limits on serverless

- **Rate limiting** is in-memory (per lambda) — fine for basic abuse control; use
  Upstash Redis if you need it shared across instances.
- **Image uploads**: paste URLs on Vercel. To enable real uploads, add
  `@vercel/blob` and swap the `writeFile` call in
  `src/app/api/admin/upload/route.ts`.
- **Change admin password later**: update the env vars and re-run the seed
  (step 2) against the Neon DB — it upserts and re-hashes.
