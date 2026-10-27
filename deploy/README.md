# Запуск «Капитала» на своём сервере

Нужен любой VPS с Ubuntu 22.04/24.04 (1 vCPU и 1 ГБ памяти хватает), домен и доступ по SSH.
Игра и база живут в одном контейнере, HTTPS выдаёт Caddy. Всё, что нужно сохранить, лежит в
docker-томе `kapital-data`: база `kapital.sqlite` и ключ шифрования `secret.key`.

## Сервер в России

Для игроков из России сервер лучше брать в российском дата-центре (Timeweb Cloud, Selectel, Beget):
задержка 5–30 мс вместо 40–70 мс, оплата российской картой, почты игроков хранятся в России, как
требует 152-ФЗ. Hetzner и другие зарубежные хостинги не принимают российских клиентов или
замедляются операторами связи.

**Docker Hub.** Если `docker compose up` зависает на скачивании `node:22-alpine` или `caddy:2`,
подключите зеркало хостинга и перезапустите Docker:

```sh
cat > /etc/docker/daemon.json <<'JSON'
{ "registry-mirrors": ["https://dockerhub.timeweb.cloud", "https://mirror.gcr.io"] }
JSON
systemctl restart docker
```

У Beget зеркало `https://dockerhub1.beget.com`. Если не открывается `get.docker.com`, выберите при
создании сервера готовый образ Ubuntu с Docker из маркетплейса хостинга.

**Способы входа.** С 7 июля 2026 владелец российского сайта платит штраф за вход через зарубежные
сервисы (КоАП 13.55, физлицо — 10–20 тыс. ₽). Разрешены российский номер телефона, Госуслуги и
российские ID: Яндекс, VK, Сбер. Поэтому оставьте `KAPITAL_GOOGLE_*` пустыми и включите Яндекс.
Telegram в законе не назван и в России работает с перебоями: включать его стоит осознанно.

**Сертификат.** Caddy получает его у Let's Encrypt: частным лицам и компаниям без санкций из России
он выдаётся. Если выпуск откажет, `docker compose logs caddy` покажет причину; запасной путь —
купить платный сертификат у российского регистратора (DigiCert и Sectigo для .ru не выдают, уточните
удостоверяющий центр) и указать файлы в Caddyfile директивой `tls`.

## 1. Домен

В панели регистратора создайте A-запись домена (например `kapital.example.com`) на IP сервера.
Пока запись не разойдётся, сертификат не выпустится: проверьте `ping kapital.example.com`.

## 2. Сервер

```sh
ssh root@IP
apt update && apt install -y git curl
curl -fsSL https://get.docker.com | sh
git clone https://github.com/Kyronison/kapital.git /opt/kapital
cd /opt/kapital/deploy
cp .env.example .env
nano .env        # домен, KAPITAL_SECRET (openssl rand -hex 32), почта и ключи входа — что есть
docker compose up -d --build
docker compose logs -f kapital   # «слушает порт 8080» и список включённых способов входа
```

Откройте `https://kapital.example.com`. Если сайт не открывается, `docker compose logs caddy`
покажет, получил ли Caddy сертификат (порты 80 и 443 должны быть открыты в файрволе хостинга).

## 3. Способы входа

Сервер показывает только настроенные способы, поэтому начать можно с одной почты.

| Способ | Что нужно |
| --- | --- |
| Почта | SMTP любого почтового сервиса. У Яндекса и Mail.ru это «пароль приложения» в настройках почты; адрес вида `smtps://login:пароль@smtp.yandex.ru:465` — в `KAPITAL_SMTP_URL` |
| Google | OAuth client ID в Google Cloud Console, redirect URI `https://домен/api/auth/oauth/google/callback` |
| Яндекс | Приложение на oauth.yandex.ru, redirect URI `https://домен/api/auth/oauth/yandex/callback` |
| Telegram | Бот от @BotFather (токен) и команда `/setdomain` с вашим доменом |

После правки `.env`: `docker compose up -d` (контейнер перечитает переменные).

## 4. Резервные копии

```sh
/opt/kapital/deploy/backup.sh            # копия в /opt/kapital/deploy/backups
crontab -e                                # каждую ночь в 4:00
0 4 * * * /opt/kapital/deploy/backup.sh >> /var/log/kapital-backup.log 2>&1
```

Копии стоит забирать с сервера (`scp root@IP:/opt/kapital/deploy/backups/* .`). Без `secret.key`
(или `KAPITAL_SECRET` из `.env`) база не расшифруется.

Восстановление: остановить игру, положить копию на место базы, запустить.

```sh
cd /opt/kapital/deploy && docker compose stop kapital
docker compose cp backups/kapital-ДАТА.sqlite kapital:/data/kapital.sqlite
docker compose start kapital
```

## 5. Обновление

```sh
cd /opt/kapital && git pull && cd deploy && docker compose up -d --build
```

Партии, которые идут в этот момент, прервутся на несколько секунд: игроки вернутся на свои места
из аккаунта, незаконченные партии сохранены в базе.
