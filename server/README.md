# Gharpayy CRM Backend — VPS Deployment Runbook

This server is **not** deployed by Lovable. It runs on **your VPS**, talks to **MongoDB Atlas** (Mumbai), and is reached by the frontend via `VITE_API_URL`.

---

## 1. Prerequisites on the VPS

```bash
# Ubuntu 22.04+ assumed
sudo apt update && sudo apt install -y curl git build-essential
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
# Redis (local; or use a managed Redis later)
sudo apt install -y redis-server && sudo systemctl enable --now redis-server
# pm2 process manager
sudo npm i -g pm2
# nginx (reverse proxy + TLS)
sudo apt install -y nginx certbot python3-certbot-nginx
```

## 2. MongoDB Atlas (one-time)

1. https://cloud.mongodb.com → create project → **Build a Cluster** → M0 free or M10.
2. Region: **Mumbai (ap-south-1)** on AWS.
3. Database Access → add user `gharpayy_app` with strong password. Role: `readWrite` on db `gharpayy`.
4. Network Access → add your VPS public IP (or `0.0.0.0/0` temporarily, lock down later).
5. Connect → drivers → copy SRV: `mongodb+srv://gharpayy_app:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

## 3. Deploy

```bash
# On the VPS
cd /opt
sudo git clone <your-repo-url> gharpayy && cd gharpayy/server
sudo npm i
sudo npm run build
cp .env.example .env
nano .env   # paste MONGO_URL, generate JWT_SECRET, set CORS_ORIGINS
```

Generate `JWT_SECRET`:
```bash
openssl rand -base64 48
```

Start with pm2:
```bash
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup    # auto-start on reboot
```

## 4. nginx + TLS

```nginx
# /etc/nginx/sites-available/gharpayy-api
server {
  server_name api.gharpayy.com;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Socket.IO upgrade
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
  }
  listen 80;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/gharpayy-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.gharpayy.com
```

## 5. Wire frontend to the API

In **Lovable → Project Settings → Environment Variables**, add:
```
VITE_API_URL = https://api.gharpayy.com
```
Republish the frontend. Visit `/login` to sign up the first admin user, then `/live-leads`.

## 6. Verify

```bash
curl https://api.gharpayy.com/api/health    # → {"ok":true,...}
pm2 logs gharpayy-api --lines 50            # see Mongo + Socket.IO startup
pm2 logs gharpayy-worker                     # automation worker logging events
```

## 7. Operate

- **Logs**: `pm2 logs`. Add Datadog/Honeycomb later via OTel.
- **Update**: `git pull && cd server && npm i && npm run build && pm2 startOrRestart ecosystem.config.cjs`
- **Backups**: Atlas → Backup → enable continuous (M10+).
- **Indexes** are created on first boot (see `server/src/db/mongo.ts`).
- **Rate limit**: 300 req/min per IP via `@fastify/rate-limit`. Tighten in prod.

## 8. Architecture you just deployed

```
  Browser ──HTTPS──► nginx :443 ──► Fastify :4000 ──► MongoDB Atlas (Mumbai)
     │                                  │
     │                                  └──► Redis (pub/sub + BullMQ + rate-limit)
     │                                          │
     └──WSS──► Socket.IO ◄── pub/sub ──── Worker (automation rules)
```

Every state change is a `cmd.*` POSTed to `/api/commands` with an `Idempotency-Key`. The server validates, writes Mongo, appends an `evt.*` to `entity_event`, publishes to Redis. Socket.IO + the worker both consume.

## 9. Next phases (per blueprint)

- Phase 3: Tour + Inventory commands/events
- Phase 4: Mongo-backed automation rules + Admin UI
- Phase 5: WhatsApp/dialer/payments connectors (vendor decision pending)
