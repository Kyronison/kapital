import { SaveStore } from './saves.js';
import { createServer } from './server.js';

const port = Number(process.env.PORT ?? 2567);
const saves = new SaveStore(process.env.KAPITAL_SAVE_DIR ?? 'saves');
await createServer({ saves }).listen(port);
console.log(`Игровой сервер «Капитал» слушает порт ${port}`);
