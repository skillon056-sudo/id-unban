# Prompt: add a second website to my existing VPS

Copy everything below the line into a fresh session, replace the ALL-CAPS
placeholders, and hand over the SSH access.

---

I want to put a **second, separate website** on a VPS that already runs a live
site. The live site must not go down or change in any way.

## Server access

- **Host:** `187.127.186.4` (Ubuntu 24.04 LTS, 2 vCPU, 7.8 GB RAM, 94 GB free)
- **User:** `root`
- **Login:** SSH key (already installed) — `ssh root@187.127.186.4`
  - If you need a password instead, ask me and I'll supply it. Do not put any
    password in a file on the server.

## What is already on this box — do not disturb any of it

| Thing | Value |
|---|---|
| Live app | `/var/www/id-unban`, pm2 process `id-unban`, **port 3001** |
| Live domain | `ffidunban.com` (+ `www`), SSL via certbot, auto-renew on |
| nginx site file | `/etc/nginx/sites-available/id-unban` (only enabled site) |
| PostgreSQL 16 | role `idunban`, database `idunban` — for the live site only |
| Node / npm / pm2 | v20.20.2 / 10.8.2 / 7.0.4 (already installed, reuse them) |
| Firewall | ufw active: OpenSSH + Nginx Full already allowed |
| Cron | `*/15 * * * * /usr/local/bin/capi-sweep.sh` (live site's job) |

**Rules:**
1. Never edit, move or restart anything under `/var/www/id-unban`, its pm2
   process, its nginx file, its database, or its cron.
2. Do not run `ufw enable/reset` again, and do not remove existing nginx sites.
3. Do not touch the existing certbot certificate or its renewal timer.
4. Do not upgrade Node, nginx or PostgreSQL.

## What I want you to set up for the NEW site

- **Directory:** `/var/www/NEW_APP_NAME`
- **pm2 process name:** `NEW_APP_NAME`
- **Port:** `3002` (3001 is taken; check with `ss -ltnp` before choosing)
- **Database (only if the new site needs one):** create a *separate* role and
  database, e.g. role `NEW_APP_NAME` with a freshly generated strong password,
  database `NEW_APP_NAME`. Never reuse the `idunban` role or database.
- **Domain:** `NEW_DOMAIN_HERE`
- **nginx:** a new file `/etc/nginx/sites-available/NEW_APP_NAME` with its own
  `server_name`, proxying to `127.0.0.1:3002`. Run `nginx -t` before reloading.
- **SSL:** `certbot --nginx -d NEW_DOMAIN -d www.NEW_DOMAIN --redirect`
  (the certbot renewal timer is already enabled; don't create another).
- **Autostart:** `pm2 save` after starting, so it survives a reboot.
- Put secrets in the app's own `.env`, `chmod 600`.

## The site itself

NEW_APP_NAME is: **DESCRIBE_THE_SITE_HERE** (what it does, what stack — e.g.
Next.js / plain HTML / WordPress / Node API).

Source: **GITHUB_URL_OR_"I'll upload a zip"**

Credentials the new site needs (fill in only what applies, or say "none"):

```
Domain registrar        : REGISTRAR_NAME (I'll point the DNS myself)
Database needed?        : yes / no
Payment gateway         : NAME + API key/secret (if any)
Email/SMTP              : host, port, user, password (if any)
Any API keys            : ...
Admin login to create   : email + password you want
```

## DNS

I will add these records myself once you confirm the server is ready:

```
A   @     187.127.186.4
A   www   187.127.186.4
```

Tell me when to add them, and confirm once the site answers on HTTPS.

## Deployment style I want

Build the app **beside** the running copy and swap it in, rather than building
in place — an in-place `next build` (or similar) empties the folder the live
process is serving from, and visitors get a broken page for the whole build.
The existing site uses `/var/www/id-unban/deploy.sh` for this; copy that
pattern.

Also: if you copy files from a Windows machine, make sure shell scripts keep
**LF line endings** — CRLF makes bash fail on the first line.

## When you're done, tell me

1. The new site's URL and that HTTPS works
2. The admin login (if any)
3. The database name/user you created
4. Exactly which files you added or changed outside the new app's folder
5. Confirmation that `ffidunban.com` is still up and its pm2 process untouched
