# Empleado24 on Hetzner CPX22

## Production topology

`Internet → Traefik (TLS) → Next.js app → Supabase / Stripe / Retell / provider APIs`.

Redis is deployed privately for operational use and is the primary global rate-limit store when `REDIS_URL` is configured. Supabase remains the managed production database and durable fallback.

Portainer is available through `portainer.empleado24.com` and Uptime Kuma through `status.empleado24.com`; create their administrator accounts on the first visit after DNS cutover. Updates are performed only through the controlled GitHub Actions deployment, not Watchtower.

## First server preparation

Run as root on Ubuntu 24.04:

```sh
apt update && apt -y upgrade
apt install -y ca-certificates curl git ufw fail2ban
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
adduser --disabled-password --gecos '' deploy
mkdir -p /opt/empleado24 && chown deploy:deploy /opt/empleado24
```

Create a non-root SSH key for GitHub Actions, add it to `/home/deploy/.ssh/authorized_keys`, clone the repository under `/opt/empleado24`, copy `infra/hetzner/production.env.example` to `.env.production`, fill every required value and run `chmod 600 .env.production`.

For the GitHub deployment workflow, set repository **Variables** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, plus production **Secrets** `HETZNER_HOST` and `HETZNER_SSH_KEY`. No application secret is placed in the image or repository.

## DNS before first start

Create A records for `empleado24.com`, `www.empleado24.com`, `cerradores.com`, `www.cerradores.com`, `portainer.empleado24.com` and `status.empleado24.com` pointing to the CPX22 public IPv4. Do not remove the existing Vercel records until the health check and webhook validation pass.

## Start and verify

```sh
cd /opt/empleado24
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose --env-file .env.production ps
curl --fail https://empleado24.com/api/health
docker compose --env-file .env.production logs --tail=100 app cron backup traefik
```

## Zero-downtime migration

1. Lower DNS TTL to 60 seconds at least 24 hours before cutover.
2. Start the VPS using the same production secrets and validate `https://<server-ip>/api/health` through a temporary hosts-file override.
3. Register the permanent production webhook URLs with Stripe, Retell, Meta and Google only after TLS is valid.
4. Change the four DNS records to the VPS, retain Vercel for 48 hours as rollback.
5. Verify registration, Stripe checkout/webhook, a Retell call and Guardian from the VPS logs.

## Rollback

If a critical check fails, restore the prior DNS records to Vercel. On the VPS use the last immutable image tag:

```sh
APP_IMAGE=ghcr.io/proyectoseconomicosexclusivos-cmd/empleado24:<known-good-sha> docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Database recovery is never performed in-place. Restore the latest checked archive to an isolated database with `scripts/vps/restore-check.sh`, validate it, then follow the Supabase recovery procedure.
