# Запуск «Капитала» на своём сервере

Нужен Linux VPS, домен и доступ по SSH. Команды ниже рассчитаны на Ubuntu 22.04/24.04.
Объём памяти и CPU подбирайте под сборку и ожидаемую нагрузку.
Игра и база живут в одном контейнере, HTTPS выдаёт Caddy. База `kapital.sqlite` хранится в
docker-томе `kapital-data`. Ключ шифрования берётся из `KAPITAL_SECRET` в `.env` или из
автоматически созданного файла `secret.key` в томе. Сохраняйте и базу, и используемый ключ.

## Перед запуском

Проверьте доступ сервера к GitHub и реестрам контейнеров, а также наличие Docker Engine
и плагина Docker Compose. Для домена понадобятся корректная DNS-запись и открытые порты
80 и 443. Публичный репозиторий клонируется без токена GitHub.

Если скачивание образов зависает, проверьте сетевой доступ и настройки Docker. При необходимости
настройте зеркало по документации выбранного хостинга, сохранив остальные параметры
`/etc/docker/daemon.json`.

Caddy настроен на автоматический HTTPS для указанного домена. При ошибке выпуска сертификата
посмотрите `docker compose logs caddy` и проверьте DNS и доступность портов.

Способы входа включаются отдельно через `.env`: настройте только те интеграции, которые нужны
вашему экземпляру игры. Пустые параметры отключают соответствующий способ входа.

## 1. Домен

В панели регистратора создайте A-запись домена (например `kapital.example.com`) на IP сервера.
Проверьте, что домен разрешается в адрес вашего сервера, например командой
`getent ahostsv4 kapital.example.com`.

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

Перезапуск контейнера разрывает активные соединения. Сервер загружает сохранённые партии
из базы; перед обновлением сделайте резервную копию.
