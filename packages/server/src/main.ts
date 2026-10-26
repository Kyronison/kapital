import { createServer } from './server.js';

const port = Number(process.env.PORT ?? 2567);
await createServer().listen(port);
console.log(`Игровой сервер «Капитал» слушает порт ${port}`);
