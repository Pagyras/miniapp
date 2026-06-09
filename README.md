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
