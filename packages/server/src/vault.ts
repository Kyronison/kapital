import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Ключи и шифрование данных на диске. Из одного секрета выводятся ключ шифрования (AES-256-GCM)
 * и ключ подписи (HMAC): по подписи почту можно найти, не храня её открыто.
 * Секрет берётся из KAPITAL_SECRET, иначе создаётся один раз в файле рядом с базой.
 */
export class Vault {
  private readonly enc: Buffer;
  private readonly mac: Buffer;

  constructor(secret: Buffer) {
    if (secret.length < 32) throw new Error('Секрет должен быть не короче 32 байт');
    this.enc = Buffer.from(hkdfSync('sha256', secret, '', 'kapital-encrypt', 32));
    this.mac = Buffer.from(hkdfSync('sha256', secret, '', 'kapital-sign', 32));
  }

  /** Секрет из переменной окружения или из файла, который создаётся при первом запуске. */
  static load(dataDir: string, env = process.env.KAPITAL_SECRET): Vault {
    if (env) return new Vault(Buffer.from(env, /^[0-9a-f]+$/i.test(env) ? 'hex' : 'base64'));
    const file = join(dataDir, 'secret.key');
    if (!existsSync(file)) {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(file, randomBytes(32).toString('hex') + '\n', { mode: 0o600 });
    }
    return new Vault(Buffer.from(readFileSync(file, 'utf8').trim(), 'hex'));
  }

  /** Строка → base64 (nonce | тег | шифртекст). */
  seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.enc, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }

  open(sealed: string): string {
    const buf = Buffer.from(sealed, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.enc, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  }

  /** Подпись для поиска: одинаковая почта → одинаковая строка, а восстановить почту по ней нельзя. */
  sign(text: string): string {
    return createHmac('sha256', this.mac).update(text).digest('hex');
  }
}

const SCRYPT = { N: 16384, r: 8, p: 1 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function checkPassword(password: string, stored: string): boolean {
  const [kind, n, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { ...SCRYPT, N: Number(n) });
  return timingSafeEqual(actual, expected);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
