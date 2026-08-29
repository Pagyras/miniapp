# Родная кухня Mini App

Отдельная standalone-версия Telegram Mini App для демо и публикации на GitHub.

## Запуск локально

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
npm run preview
```

## Telegram Bot

Бот отправляет приветствие и inline-кнопку `Сделать заказ`, которая открывает Mini App. Для админов бот также показывает новые заказы, меняет статусы и редактирует товары.

```bash
BOT_TOKEN=123456:telegram-token MINIAPP_URL=https://pagyras.github.io/miniapp/ npm run bot
```

Переменные:

- `BOT_TOKEN` — токен бота из BotFather.
- `MINIAPP_URL` — ссылка на опубликованный Mini App.
- `BOT_START_TEXT` — текст приветствия, опционально.
- `BOT_API_URL` — URL backend API.
- `API_ADMIN_TOKEN` — токен для админских API-запросов.
- `API_ADMIN_TELEGRAM_IDS` — Telegram ID админов через запятую, опционально. Если пусто, админ-бот доступен всем, кто знает бота.
- `ADMIN_SUBSCRIBERS_PATH` — файл со списком чатов, куда админ-бот отправляет уведомления о новых заказах.

Админ-команды:

- `/admin` или `/orders` — активные заказы с кнопками статусов.
- `/products` — список товаров.
- `/products сырники` — поиск товаров.
- `/price product-id 700` — изменить цену.
- `/stock product-id 12` — изменить остаток.
- `/stop product-id` — скрыть товар из каталога.
- `/show product-id` — вернуть товар в каталог.
- `/photo product-id https://...` — заменить фото товара.
- фото с подписью `/photo product-id` — заменить фото на отправленное в Telegram.

## Backend API

Backend хранит данные в SQLite и отдает маршруты, которые использует Mini App и админ-бот.

```bash
npm run api
```

Маршруты:

- `GET /health`
- `GET /categories`
- `GET /products`
- `POST /users`
- `GET /orders?telegramUserId=...`
- `POST /orders`
- `GET /admin/orders`
- `GET /admin/users`
- `GET /admin/stock-movements`
- `GET /admin/audit-events`
- `PATCH /admin/orders/:id/status`
- `PATCH /admin/orders/:id/payment`
- `PATCH /admin/products/:id`

Для подключения фронта к локальному API:

```env
VITE_API_URL=http://localhost:8787
VITE_DEMO_MODE=false
```

Админские маршруты требуют `X-Admin-Token` или `X-Admin-Telegram-Id`.

```env
API_ADMIN_TOKEN=local-secret
API_ADMIN_TELEGRAM_IDS=123456789,987654321
API_REQUIRE_TELEGRAM_AUTH=false
SQLITE_DB_PATH=data/app.sqlite
```

Для production с Telegram Mini App нужно включить проверку initData:

```env
BOT_TOKEN=123456:telegram-token
API_REQUIRE_TELEGRAM_AUTH=true
```

## Демо-режим

По умолчанию включен `VITE_DEMO_MODE=true`. Если API недоступен, каталог берется из локальных seed-данных, а оформление заказа имитируется внутри браузера.

Для подключения к рабочему API укажите:

```env
VITE_API_URL=https://your-api-domain.ru
VITE_DEMO_MODE=false
```

## GitHub Pages

В репозитории включен workflow `.github/workflows/deploy.yml`. Для деплоя:

1. Залейте проект в отдельный GitHub-репозиторий.
2. В настройках репозитория включите Pages через GitHub Actions.
3. По умолчанию workflow сам выставит base-path как `/<repo-name>/`. Для кастомного домена задайте `VITE_BASE_PATH=/` в GitHub Actions variables.
