// Запускает игровой сервер и клиент одной командой: `pnpm dev`. Ctrl+C останавливает оба.
import { spawn } from 'node:child_process';

const parts = [
  { name: 'сервер', color: 32, args: ['start'] },
  { name: 'сайт', color: 36, args: ['web'] },
];

const children = parts.map(({ name, color, args }) => {
  // shell нужен на Windows, где pnpm — это pnpm.cmd
  const child = spawn('pnpm', args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) {
    let rest = '';
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split(/\r?\n/);
      rest = lines.pop() ?? '';
      for (const line of lines) process.stdout.write(prefix + line + '\n');
    });
  }
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}остановлен${code ? ` с кодом ${code}` : ''}\n`);
    stop(code ?? 0);
  });
  return child;
});

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    // на Windows дочерние процессы pnpm закрываются только вместе с деревом
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(c.pid), '/t', '/f'], { stdio: 'ignore' });
    else c.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
