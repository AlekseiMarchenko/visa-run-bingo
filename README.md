# Visa Run Bingo – Telegram Backend

This directory contains a Node/Express server and [Telegraf](https://telegraf.js.org/) bot implementation for the **Visa Run Bingo** game. The backend authenticates users of the WebApp via Telegram, manages game state on the server, and provides a few simple REST endpoints consumed by the React client.

## Features

* ✅ **WebApp authentication.** The server validates Telegram WebApp `initData` using the official HMAC algorithm and exposes an `/api/auth/verify` endpoint to return per‑user game state.
* 🎲 **Game state management.** Each user has a small state object containing the number of keys/tickets/coins, bingo grid status and completed tasks. State is held in memory for demo purposes; swap the in‑memory `Map` for a database in production.
* 🏙 **City grid.** A list of nine default visa‑run destinations is defined in `CITY_LIST`. When the client calls `/api/city/open` the server checks if the user has any keys, chooses a random unopened city, marks it as opened, deducts one key and adds a ticket.
* ✅ **Task completion and rewards.** Tasks are defined in `TASK_DEFINITIONS`. Some tasks (e.g. channel subscription) require a server‑side check – the server queries the Telegram API to verify membership before crediting rewards. Other tasks simply record the provided metadata and update the user’s keys/tickets.
* 📢 **Referral support.** When a user launches the bot via `/start ref_<id>` the inviter is rewarded with an extra key and ticket, provided the invitee hasn’t visited the bot before.
* 🛠 **Long polling & webhooks.** The bot will run via long polling during local development. If you set `USE_WEBHOOK=1` and provide `WEBHOOK_DOMAIN` the bot will use webhooks instead (remember to expose your server over HTTPS).

## Getting started

1. **Install dependencies.** This project relies on Express and Telegraf. Install them with npm:

   ```bash
   cd visa-run-bingo/server
   npm install
   ```

2. **Configure environment variables.** Copy `.env.example` to `.env` and fill in your values:

   ```bash
   cp .env.example .env
   # then edit .env and set BOT_TOKEN, CHANNEL_ID etc.
   ```

   * `BOT_TOKEN` – your Telegram bot token from @BotFather. **Keep this secret!**
   * `WEBAPP_URL` – the URL of your React app. Use `http://localhost:5173` during development or your deployed domain in production.
   * `CHANNEL_ID` – numeric ID of the channel users must subscribe to for the “Подпишись на канал” task. You can find it by forwarding a message from your channel to [@jsondumpbot](https://t.me/jsondumpbot).
   * `PORT` – the HTTP port (default `8080`).
   * `USE_WEBHOOK` – set to `0` for long polling (recommended during development). Set to `1` when deploying behind HTTPS to enable webhooks.
   * `WEBHOOK_DOMAIN` – required if `USE_WEBHOOK=1`; the base HTTPS URL of your server used to register the Telegram webhook (e.g. `https://your-domain.com`).
   * `BOT_USERNAME` – (optional) the bot username without the leading `@`. This is only used to construct referral links.

3. **Run the server.** Start the Express API and Telegram bot:

   ```bash
   npm start
   ```

   You should see output similar to:

   ```
   API listening on :8080
   Bot started with long polling
   ```

4. **Test the bot.** In Telegram, send `/start` to your bot. You should receive a message containing a button labelled “Открыть Веб‑приложение” which launches your React client. Sending `/link` returns your personal referral deep link.

5. **Use the REST API.** When the WebApp runs inside Telegram, it sends the `x-telegram-initdata` header to the API. The server validates this header, initialises the user state if necessary and returns it to the client. Endpoints:

| Method | Path                | Description                                             |
|--------|---------------------|---------------------------------------------------------|
| POST   | `/api/auth/verify` | Validate WebApp init data and return the user state.    |
| POST   | `/api/city/open`    | Open a random city if the user has any keys left.       |
| POST   | `/api/task/complete`| Mark a task as completed, perform server‑side checks, and credit rewards. |
| GET    | `/api/health`      | Simple health check to verify the server is running.    |

## Deployment

When you’re ready to deploy, you can package this server as a Docker container or run it on a platform of your choice (Render, Fly.io, etc.). To use webhooks in production, expose your server over HTTPS and set `USE_WEBHOOK=1` and `WEBHOOK_DOMAIN` to your domain. Telegraf will automatically register the webhook at `WEBHOOK_DOMAIN/bot`.

You may also want to persist user state to a database such as PostgreSQL or Redis. Replace the in‑memory `Map` with calls to your database layer in `server.js`.

## Security note

Your Telegram bot token is a secret. **Never commit it to version control or share it publicly.** This repository includes `.env.example` to encourage you to keep secrets in environment variables. If you accidentally leak your token, revoke it via @BotFather and obtain a new one.
