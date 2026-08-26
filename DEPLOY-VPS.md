# Deploy on a Hostinger VPS (alongside an existing app)

Runs this site on its own domain, next to whatever you already have on the box.
Nginx routes by domain name, so both apps share ports 80/443 without clashing.

**Why the VPS beats Vercel here:** Postgres runs locally (no Neon cold start —
queries drop from seconds to ~1ms), file uploads in Admin → Appearance actually
persist, and there are no serverless timeouts.

Assumes Ubuntu. Replace `ffcheck.example.com` with your real domain.

---

## 0. Point the domain at the VPS

In your DNS panel add an **A record**: `ffcheck.example.com` → your VPS IP.
Do this first — SSL in step 7 needs it resolving.

## 1. Check what port your existing app uses

```bash
sudo ss -tlnp | grep node
```

If it's on `3000`, this app will use **`3001`**. Adjust below if needed.

## 2. Install Node 20 + PM2 (skip what you already have)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs && sudo npm install -g pm2
```

## 3. Install PostgreSQL locally

```bash
sudo apt update && sudo apt install -y postgresql
```

Create the database and user:

```bash
sudo -u postgres psql -c "CREATE USER ffuser WITH PASSWORD 'CHANGE_THIS_PASSWORD';" -c "CREATE DATABASE ffdb OWNER ffuser;"
```

Your connection string is then:
`postgresql://ffuser:CHANGE_THIS_PASSWORD@localhost:5432/ffdb`

## 4. Get the code

```bash
cd /var/www && sudo git clone https://github.com/skillon056-sudo/id-unban.git ffcheck && sudo chown -R $USER:$USER ffcheck && cd ffcheck
```

## 5. Environment file

```bash
nano /var/www/ffcheck/.env
```

Paste (fill in your own values):

```env
DATABASE_URL="postgresql://ffuser:CHANGE_THIS_PASSWORD@localhost:5432/ffdb"

SESSION_SECRET="run: openssl rand -hex 48"
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="a-strong-password"

NEXT_PUBLIC_SITE_NAME="FF ID Recovery"
NEXT_PUBLIC_BASE_URL="https://ffcheck.example.com"

PAYMENT_GATEWAY="sunpay"
SUNPAY_BASE_URL="https://sunpaytm.quest"
SUNPAY_PAYIN_PATH="/api/public/v1/payins"
SUNPAY_METHOD="upi"
SUNPAY_CURRENCY="INR"
SUNPAY_MIN_AMOUNT="100"
SUNPAY_PAYIN_API_KEY=""
SUNPAY_PAYIN_API_SECRET=""
SUNPAY_WEBHOOK_SECRET=""

RAPIDAPI_KEY=""
RAPIDAPI_IDCHECK_HOST="id-game-checker.p.rapidapi.com"

BANCHECK_API_URL="https://ff-ban-check-omega.vercel.app"
BANCHECK_API_KEY="refatbd"
```

Generate the session secret with:

```bash
openssl rand -hex 48
```

## 6. Install, migrate, build, start

```bash
cd /var/www/ffcheck && npm ci && npx prisma db push && npm run db:seed && npm run build
```

Start it on port 3001 under PM2:

```bash
cd /var/www/ffcheck && PORT=3001 pm2 start npm --name ffcheck -- start && pm2 save && pm2 startup
```

Run the `sudo env PATH=...` line that `pm2 startup` prints, so it survives reboots.

## 7. Nginx + SSL

```bash
sudo nano /etc/nginx/sites-available/ffcheck
```

```nginx
server {
    listen 80;
    server_name ffcheck.example.com;

    client_max_body_size 10M;   # Admin → Appearance image uploads

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it and get a certificate:

```bash
sudo ln -s /etc/nginx/sites-available/ffcheck /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
```

```bash
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d ffcheck.example.com
```

Certbot rewrites the config for HTTPS and auto-renews. **HTTPS is required** —
Sunpay rejects non-HTTPS notify URLs.

Your existing app is untouched: it keeps its own file in `sites-available` with
its own `server_name` and port.

## 8. Register the webhook

In the Sunpay dashboard set the pay-in notify URL to:

```
https://ffcheck.example.com/api/payment/webhook
```

---

## Updating later

```bash
cd /var/www/ffcheck && git pull && npm ci && npx prisma db push && npm run build && pm2 restart ffcheck
```

## Useful commands

```bash
pm2 logs ffcheck --lines 100
```

```bash
pm2 restart ffcheck
```

```bash
pm2 status
```

## Back up the database

```bash
sudo -u postgres pg_dump ffdb > ~/ffdb-$(date +%F).sql
```

Worth putting in a daily cron — the VPS has no automatic backups the way a
managed database does.

## Firewall

Only 80/443 (and SSH) need to be open. Postgres stays on localhost — do **not**
expose 5432 to the internet.

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```
