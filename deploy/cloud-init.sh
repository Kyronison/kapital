#!/bin/bash
# Первый запуск сервера без SSH: вставьте этот файл в поле cloud-init при создании VPS
# Заполните KAPITAL_DOMAIN ниже. Ход установки: /var/log/kapital-init.log
# Публичный репозиторий клонируется без учётных данных GitHub.
#
# KAPITAL_DOMAIN — ваш домен с A-записью на IP сервера. Пусто — временный адрес <IP>.sslip.io.
KAPITAL_DOMAIN=

exec >>/var/log/kapital-init.log 2>&1
set -eu

# Подкачка для сборки сайта на сервере с небольшим объёмом памяти
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Зеркала Docker Registry; проверьте их доступность для выбранного сервера
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{ "registry-mirrors": ["https://dockerhub.timeweb.cloud", "https://dockerhub1.beget.com", "https://mirror.gcr.io"] }
JSON

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git curl openssl
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh || apt-get install -y docker.io docker-compose-v2
fi
systemctl restart docker

if [ ! -d /opt/kapital ]; then
  git clone https://github.com/Kyronison/kapital.git /opt/kapital
fi
cd /opt/kapital/deploy

if [ -z "$KAPITAL_DOMAIN" ]; then
  IP=$(curl -fsS https://ipv4.icanhazip.com || hostname -I | awk '{print $1}')
  KAPITAL_DOMAIN="${IP}.sslip.io"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^KAPITAL_DOMAIN=.*|KAPITAL_DOMAIN=${KAPITAL_DOMAIN}|" .env
  sed -i "s|^KAPITAL_PUBLIC_URL=.*|KAPITAL_PUBLIC_URL=https://${KAPITAL_DOMAIN}|" .env
  sed -i "s|^KAPITAL_SECRET=.*|KAPITAL_SECRET=$(openssl rand -hex 32)|" .env
  chmod 600 .env
fi

docker compose up -d --build

chmod +x backup.sh
(crontab -l 2>/dev/null; echo '0 4 * * * /opt/kapital/deploy/backup.sh >> /var/log/kapital-backup.log 2>&1') | sort -u | crontab -

echo "ГОТОВО: https://${KAPITAL_DOMAIN}"
