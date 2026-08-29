# Деплой на dostavly.ru

## 1. DNS

Создайте A-записи на IP сервера:

- `dostavly.ru`
- `www.dostavly.ru`
- `api.dostavly.ru`

## 2. Сервер

Пример для Ubuntu:

```bash
apt update
apt install -y nginx certbot python3-certbot-nginx git
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
```

## 3. Проект

```bash
mkdir -p /var/www/dostavly
cd /var/www/dostavly
git clone <repo-url> app
cd app
npm ci
cp .env.production.example .env
nano .env
```

В `.env` обязательно замените токены, пароль и `API_ADMIN_TOKEN`.

## 4. Сборка миниаппа

```bash
cd /var/www/dostavly/app
npm run build
```

Статика будет в:

```text
/var/www/dostavly/app/dist
```

## 5. Nginx

Создайте конфиг:

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

Активируйте:

```bash
ln -s /etc/nginx/sites-available/dostavly /etc/nginx/sites-enabled/dostavly
nginx -t
systemctl reload nginx
```

## 6. HTTPS

```bash
certbot --nginx -d dostavly.ru -d www.dostavly.ru -d api.dostavly.ru
```

## 7. Запуск API и ботов

```bash
cd /var/www/dostavly/app
pm2 start npm --name dostavly-api -- run api
pm2 start npm --name dostavly-user-bot -- run bot:user
pm2 start npm --name dostavly-admin-bot -- run bot:admin
pm2 save
pm2 startup
```

Проверка:

```bash
curl https://api.dostavly.ru/health
pm2 status
pm2 logs dostavly-api
```

## 8. Telegram

В BotFather для обычного бота укажите домен миниаппа:

```text
dostavly.ru
```

В `.env` обычный бот должен открывать:

```env
MINIAPP_URL=https://dostavly.ru/
```

## 9. Обновление проекта

```bash
cd /var/www/dostavly/app
git pull
npm ci
npm run build
pm2 restart dostavly-api dostavly-user-bot dostavly-admin-bot
```
