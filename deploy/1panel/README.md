# 1Panel deployment

This stack pulls the two K-Vault images published to GHCR and starts the local
Telegram Bot API in `--local` mode. The Bot API is reachable only through the
Docker network and `127.0.0.1`, so it does not need a public Cloudflare-proxied
hostname.

## Deploy

1. Push `main` or a `v*` tag and wait for the `Docker Images` workflow to finish.
2. In GitHub Packages, make `k-vault-api` and `k-vault-web` public. For private
   packages, first log in to GHCR on the 1Panel host with a PAT containing
   `read:packages`.
3. Copy `.env.example` to `.env`, replace every placeholder, and generate each
   secret separately with `openssl rand -hex 32`.
4. In 1Panel, create a Compose application using `docker-compose.yml` and the
   values from `.env`.
5. Create a 1Panel website reverse proxy from the public domain to
   `http://127.0.0.1:8080`, matching `PUBLIC_BASE_URL`.

## Move the bot to the local API

Run these commands on the 1Panel host after the stack is healthy:

```bash
export TG_BOT_TOKEN='TOKEN'
export PUBLIC_BASE_URL='https://vault.example.com'
export TG_WEBHOOK_SECRET='TG_WEBHOOK_SECRET'

curl -fsS "https://api.telegram.org/bot${TG_BOT_TOKEN}/logOut"
curl -fsS "http://127.0.0.1:8081/bot${TG_BOT_TOKEN}/getMe"

curl -fsS -X POST "http://127.0.0.1:8081/bot${TG_BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"${PUBLIC_BASE_URL}/api/telegram/webhook\",\"secret_token\":\"${TG_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\",\"channel_post\"]}"

curl -fsS "http://127.0.0.1:8081/bot${TG_BOT_TOKEN}/getWebhookInfo"
```

The K-Vault browser upload path keeps its existing application limits. The
large-file path is Telegram client -> group/channel -> webhook -> K-Vault link.
