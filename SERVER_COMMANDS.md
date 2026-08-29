# Команды для ручной установки на сервер

## 1. На сервере подготовить директорию

```bash
mkdir -p /var/www/dostavly
```

Загрузите содержимое папки `dostavly-upload` в:

```text
/var/www/dostavly/app
```

Итоговая структура должна быть такой:

```text
/var/www/dostavly/app/package.json
/var/www/dostavly/app/src
/var/www/dostavly/app/server
/var/www/dostavly/app/bot
/var/www/dostavly/app/dist
```

## 2. Установить зависимости

```bash
cd /var/www/dostavly/app
npm ci
```

## 3. Создать production .env

```bash
cp .env.production.example .env
nano .env
```

Замените:

```env
USER_BOT_TOKEN=replace-with-user-bot-token
BOT_TOKEN=replace-with-user-bot-token
ADMIN_BOT_TOKEN=replace-with-admin-bot-token
API_ADMIN_TOKEN=replace-with-long-random-secret
ADMIN_BOT_PASSWORD=replace-with-admin-password
```

Проверьте, что стоят рабочие домены:

```env
VITE_API_URL=https://api.dostavly.ru
VITE_DEMO_MODE=false
MINIAPP_URL=https://dostavly.ru/
BOT_API_URL=http://127.0.0.1:8787
API_CORS_ORIGIN=https://dostavly.ru
API_REQUIRE_TELEGRAM_AUTH=true
```

## 4. Собрать миниапп на сервере

```bash
npm run build
```

Если используете уже загруженную папку `dist`, этот шаг можно пропустить, но лучше выполнить после заполнения `.env`.

## 5. Nginx

```bash
nano /etc/nginx/sites-available/dostavly
```

```nginx
server {
    listen 80;
    server_name dostavly.ru www.dostavly.ru;

    root /var/www/dostavly/app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    server_name api.dostavly.ru;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/dostavly /etc/nginx/sites-enabled/dostavly
nginx -t
systemctl reload nginx
```

## 6. HTTPS

```bash
certbot --nginx -d dostavly.ru -d www.dostavly.ru -d api.dostavly.ru
```

## 7. Запуск процессов

```bash
pm2 start npm --name dostavly-api -- run api
pm2 start npm --name dostavly-user-bot -- run bot:user
pm2 start npm --name dostavly-admin-bot -- run bot:admin
pm2 save
pm2 startup
```

## 8. Проверка

```bash
curl https://api.dostavly.ru/health
pm2 status
pm2 logs dostavly-api
```

Ожидаемый ответ API:

```json
{"ok":true,"database":"sqlite"}
```
