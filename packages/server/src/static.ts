import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/**
 * Раздаёт собранный клиент с того же порта, что и игровой сервер: сайту не нужен
 * отдельный хостинг, а адрес сервера совпадает с адресом страницы.
 * Неизвестные пути отдают index.html, файлы из assets кэшируются навсегда: в их именах хэш.
 */
export function staticHandler(dir: string) {
  const root = resolve(dir);
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    let path: string;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let file = normalize(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      file = join(root, 'index.html');
      info = await stat(file).catch(() => null);
      if (!info?.isFile()) {
        res.writeHead(404).end('Клиент не собран: выполните pnpm build:web');
        return;
      }
    }
    const immutable = file.startsWith(join(root, 'assets') + sep);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  };
}
