import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Auth } from './auth.js';
import { Db } from './db.js';
import { consoleMailer, smtpMailer } from './mail.js';
import { createServer } from './server.js';
import { Vault } from './vault.js';

const env = process.env;
const port = Number(env.PORT ?? 2567);
const production = env.NODE_ENV === 'production';
// база, секрет шифрования и всё остальное лежат в одной папке: её и нужно сохранять
const dataDir = env.KAPITAL_DATA_DIR ?? 'data';
const db = new Db(join(dataDir, 'kapital.sqlite'), Vault.load(dataDir));

const app = (id: string | undefined, secret: string | undefined) => (id && secret ? { id, secret } : null);
const mailer = env.KAPITAL_SMTP_URL
  ? smtpMailer(env.KAPITAL_SMTP_URL, env.KAPITAL_MAIL_FROM ?? 'Капитал <no-reply@localhost>')
  // без SMTP код из письма печатается в консоль: годится для разработки, но не для живого сайта
  : production && !env.KAPITAL_MAIL_CONSOLE ? null : consoleMailer();
const auth = new Auth(db, {
  mailer,
  google: app(env.KAPITAL_GOOGLE_ID, env.KAPITAL_GOOGLE_SECRET),
  yandex: app(env.KAPITAL_YANDEX_ID, env.KAPITAL_YANDEX_SECRET),
  telegram: env.KAPITAL_TELEGRAM_TOKEN && env.KAPITAL_TELEGRAM_BOT ? { token: env.KAPITAL_TELEGRAM_TOKEN, botName: env.KAPITAL_TELEGRAM_BOT } : null,
  publicUrl: env.KAPITAL_PUBLIC_URL?.replace(/\/$/, '') ?? null,
});
setInterval(() => db.sweep(), 3600_000).unref();

// собранный клиент раздаём с того же порта: после pnpm build:web игра открывается по адресу сервера
const webDir = env.KAPITAL_WEB_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url));
const serveWeb = existsSync(webDir);
await createServer(auth, {}, serveWeb ? { webDir } : {}).listen(port);
console.log(`Игровой сервер «Капитал» слушает порт ${port}`);
if (serveWeb) console.log(`Сайт: http://localhost:${port}`);
const p = auth.providers();
console.log(`Способы входа: почта ${p.email ? (env.KAPITAL_SMTP_URL ? 'через SMTP' : 'код в консоли') : 'выключена'}, Google ${p.google ? 'да' : 'нет'}, Яндекс ${p.yandex ? 'да' : 'нет'}, Telegram ${p.telegram ?? 'нет'}`);
