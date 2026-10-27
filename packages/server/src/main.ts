import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SaveStore } from './saves.js';
import { createServer } from './server.js';

const port = Number(process.env.PORT ?? 2567);
const saves = new SaveStore(process.env.KAPITAL_SAVE_DIR ?? 'saves');
// собранный клиент раздаём с того же порта: после pnpm build:web игра открывается по адресу сервера
const webDir = process.env.KAPITAL_WEB_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url));
const serveWeb = existsSync(webDir);
await createServer({ saves }, serveWeb ? { webDir } : {}).listen(port);
console.log(`Игровой сервер «Капитал» слушает порт ${port}`);
if (serveWeb) console.log(`Сайт: http://localhost:${port}`);
