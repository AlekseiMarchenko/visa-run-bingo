const express = require('express');
const { Telegraf } = require('telegraf');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables from .env if present
dotenv.config();

// Pull required settings from the environment
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:5173';
const CHANNEL_ID = process.env.CHANNEL_ID; // numeric Telegram channel ID for subscription check
const PORT = parseInt(process.env.PORT || '8080', 10);
const USE_WEBHOOK = parseInt(process.env.USE_WEBHOOK || '0', 10);
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required. Create a .env file or set environment variables.');
}

// In-memory datastore. In production, replace with a persistent store (e.g. Postgres, Redis).
const users = new Map();

// Definition of available cities for the bingo grid. Feel free to customise this list.
const CITY_LIST = [
  'Джохор',
  'Бангкок',
  'Куала Лумпур',
  'Сингапур',
  'Алматы',
  'Дубай',
  'Хошимин',
  'Манила',
  'Тайбэй'
];

// Task definitions. Each task grants keys and tickets when completed.
// Tasks can require server-side validation (e.g. subscription check). The client sends taskId to /api/task/complete.
const TASK_DEFINITIONS = [
  {
    id: 'subscribe',
    label: 'Подпишись на канал',
    reward: { keys: 1, tickets: 1 },
    needsCheck: true
  },
  {
    id: 'pin_bot',
    label: 'Добавь бота в закреп',
    reward: { keys: 1, tickets: 1 },
    needsCheck: false
  },
  {
    id: 'invite_friend',
    label: 'Пригласи 1 друга',
    reward: { keys: 1, tickets: 1 },
    needsCheck: false
  },
  {
    id: 'send_route',
    label: 'Отправь маршрут, откуда ты обычно летаешь',
    reward: { keys: 1, tickets: 0 },
    needsCheck: false
  },
  {
    id: 'mini_quiz',
    label: 'Пройди мини‑квиз',
    reward: { keys: 1, tickets: 1 },
    needsCheck: false
  }
];

/**
 * Parse and validate Telegram WebApp init data. Follows the algorithm described in the
 * official Telegram documentation (https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app).
 *
 * Returns an object with the parsed parameters if valid, otherwise null.
 *
 * @param {string} initData Raw init data string from Telegram WebApp
 */
function validateInitData(initData) {
  try {
    const searchParams = new URLSearchParams(initData);
    const hash = searchParams.get('hash');
    if (!hash) return null;

    // Build the data check string by sorting parameters alphabetically and excluding the hash
    const params = [];
    searchParams.forEach((value, key) => {
      if (key !== 'hash') {
        params.push(`${key}=${value}`);
      }
    });
    params.sort();
    const dataCheckString = params.join('\n');

    // Derive secret key: secret_key = HMAC_SHA256(bot_token, key="WebAppData")
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    if (computedHash !== hash) {
      return null;
    }

    // Parse user information. Telegram encodes the user JSON as a value of the 'user' parameter.
    const userStr = searchParams.get('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const authDate = parseInt(searchParams.get('auth_date') || '0', 10);
    return { user, authDate };
  } catch (err) {
    return null;
  }
}

/**
 * Initialise default state for a given user.
 * Each user starts with 0 keys and 0 tickets, all cities unopened and all tasks unset.
 *
 * @param {number} userId Telegram user ID
 */
function createDefaultState(userId) {
  return {
    userId,
    keys: 0,
    tickets: 0,
    coins: 0,
    cities: CITY_LIST.map((name) => ({ name, opened: false })),
    tasks: TASK_DEFINITIONS.map((t) => ({ id: t.id, label: t.label, done: false, meta: {} }))
  };
}

/**
 * Helper to credit keys and tickets to a user.
 *
 * @param {object} state Current user state (modified in-place)
 * @param {object} reward Reward containing keys and tickets
 */
function creditReward(state, reward) {
  state.keys += reward.keys || 0;
  state.tickets += reward.tickets || 0;
}

// Create Express app and configure middleware
const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Telegram-Initdata');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Initialise Telegram bot
const bot = new Telegraf(BOT_TOKEN);

// Handler for /start. Supports referral (start payload begins with "ref_")
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const payload = ctx.startPayload;
    if (payload && payload.startsWith('ref_')) {
      const inviterId = parseInt(payload.replace('ref_', ''), 10);
      if (inviterId && inviterId !== userId) {
        // Credit the inviter if the invited user hasn't been seen before
        if (!users.has(userId)) {
          const inviterState = users.get(inviterId) || createDefaultState(inviterId);
          creditReward(inviterState, { keys: 1, tickets: 1 });
          users.set(inviterId, inviterState);
        }
      }
    }

    // Respond with a message containing a WebApp button
    await ctx.reply('Добро пожаловать в ВизаРан Бинго! Откройте веб‑приложение, чтобы начать игру.', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Открыть Веб‑приложение',
              web_app: { url: WEBAPP_URL }
            }
          ]
        ]
      }
    });
  } catch (err) {
    console.error('Error in /start handler:', err);
  }
});

// Command to return referral link
bot.command('link', async (ctx) => {
  const userId = ctx.from.id;
  const username = process.env.BOT_USERNAME || (await bot.telegram.getMe()).username;
  const link = `https://t.me/${username}?start=ref_${userId}`;
  await ctx.replyWithMarkdownV2(`Ваша реферальная ссылка:\n${link.replace(/_/g, '\\_')}`);
});

// Launch bot: either via webhook or long polling
async function launchBot() {
  if (USE_WEBHOOK && WEBHOOK_DOMAIN) {
    const webhookPath = '/bot';
    await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${webhookPath}`);
    app.use(webhookPath, (req, res) => {
      bot.handleUpdate(req.body, res).catch((err) => {
        console.error('Webhook error:', err);
        res.sendStatus(500);
      });
    });
    console.log(`Bot listening via webhook on ${WEBHOOK_DOMAIN}`);
  } else {
    await bot.launch();
    console.log('Bot started with long polling');
  }
}

// Route to verify Telegram WebApp auth and return user state
app.post('/api/auth/verify', (req, res) => {
  const initData = req.headers['x-telegram-initdata'];
  if (!initData) {
    return res.status(400).json({ ok: false, error: 'Missing x-telegram-initdata header' });
  }
  const parsed = validateInitData(initData);
  if (!parsed || !parsed.user) {
    return res.status(401).json({ ok: false, error: 'Invalid initData' });
  }
  const userId = parsed.user.id;
  let state = users.get(userId);
  if (!state) {
    state = createDefaultState(userId);
    users.set(userId, state);
  }
  return res.json({ ok: true, state });
});

// Route to open a random city on behalf of the user
app.post('/api/city/open', (req, res) => {
  const initData = req.headers['x-telegram-initdata'];
  const parsed = validateInitData(initData || '');
  if (!parsed || !parsed.user) {
    return res.status(401).json({ ok: false, error: 'Invalid initData' });
  }
  const userId = parsed.user.id;
  let state = users.get(userId);
  if (!state) {
    state = createDefaultState(userId);
    users.set(userId, state);
  }
  if (state.keys <= 0) {
    return res.status(400).json({ ok: false, error: 'Недостаточно ключей' });
  }
  // Find unopened cities
  const unopenedIndices = state.cities
    .map((c, i) => ({ ...c, i }))
    .filter((c) => !c.opened)
    .map((c) => c.i);
  if (unopenedIndices.length === 0) {
    return res.json({ ok: true, state });
  }
  const randomIndex = unopenedIndices[Math.floor(Math.random() * unopenedIndices.length)];
  state.cities[randomIndex].opened = true;
  state.keys = Math.max(0, state.keys - 1);
  state.tickets += 1;
  return res.json({ ok: true, state });
});

// Route to complete a task
app.post('/api/task/complete', async (req, res) => {
  const initData = req.headers['x-telegram-initdata'];
  const parsed = validateInitData(initData || '');
  if (!parsed || !parsed.user) {
    return res.status(401).json({ ok: false, error: 'Invalid initData' });
  }
  const userId = parsed.user.id;
  let state = users.get(userId);
  if (!state) {
    state = createDefaultState(userId);
    users.set(userId, state);
  }
  const { taskId, payload } = req.body;
  const taskDef = TASK_DEFINITIONS.find((t) => t.id === taskId);
  if (!taskDef) {
    return res.status(400).json({ ok: false, error: 'Unknown task' });
  }
  const userTask = state.tasks.find((t) => t.id === taskId);
  if (!userTask || userTask.done) {
    return res.json({ ok: true, state });
  }
  // If the task requires server-side check (e.g. subscription), perform it
  if (taskDef.needsCheck) {
    if (!CHANNEL_ID) {
      return res.status(500).json({ ok: false, error: 'CHANNEL_ID is not configured on server' });
    }
    try {
      const member = await bot.telegram.getChatMember(CHANNEL_ID, userId);
      const status = member.status;
      if (!['member', 'creator', 'administrator'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Вы не подписаны на канал' });
      }
    } catch (err) {
      console.error('Subscription check failed:', err);
      return res.status(500).json({ ok: false, error: 'Не удалось проверить подписку' });
    }
  }
  // Mark task as done and store meta
  userTask.done = true;
  userTask.meta = payload || {};
  creditReward(state, taskDef.reward);
  users.set(userId, state);
  return res.json({ ok: true, state });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Start server and bot
app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
  launchBot().catch((err) => {
    console.error('Failed to launch Telegram bot:', err);
  });
});