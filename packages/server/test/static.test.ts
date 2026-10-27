import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { staticHandler } from '../src/static.js';

let http: Server;
let base = '';

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'kapital-web-'));
  const dir = join(root, 'dist');
  await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(join(dir, 'index.html'), '<!doctype html>');
  await writeFile(join(dir, 'assets', 'app-1a2b.js'), 'console.log(1)');
  await writeFile(join(root, 'secret.txt'), 'нельзя');
  http = createServer(staticHandler(dir));
  await new Promise<void>((r) => http.listen(0, r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => http.close(() => r())));

describe('раздача клиента', () => {
  it('отдаёт файлы, а сборку кэширует навсегда', async () => {
    const r = await fetch(`${base}/assets/app-1a2b.js`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('javascript');
    expect(r.headers.get('cache-control')).toContain('immutable');
  });

  it('незнакомый путь открывает index.html', async () => {
    const r = await fetch(`${base}/?room=abc`);
    expect(await r.text()).toBe('<!doctype html>');
    expect((await fetch(`${base}/play/abc`)).status).toBe(200);
  });

  it('не выпускает за пределы папки', async () => {
    const r = await fetch(`${base}/..%2fsecret.txt`);
    expect(r.status).toBe(403);
  });
});
