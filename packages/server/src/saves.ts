import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TableSnapshot } from './table.js';

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Сохранения незаконченных партий: по файлу JSON на стол.
 * Запись идёт через временный файл, чтобы обрыв не оставил половину сохранения.
 */
export class SaveStore {
  constructor(private readonly dir: string) {}

  private path(id: string): string {
    if (!SAFE_ID.test(id)) throw new Error('Неверный номер сохранения');
    return join(this.dir, `${id}.json`);
  }

  async save(id: string, snap: TableSnapshot): Promise<void> {
    const file = this.path(id);
    await mkdir(this.dir, { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(snap));
    await rename(tmp, file);
  }

  async load(id: string): Promise<TableSnapshot | null> {
    try {
      return JSON.parse(await readFile(this.path(id), 'utf8')) as TableSnapshot;
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<void> {
    await rm(this.path(id), { force: true });
  }
}
