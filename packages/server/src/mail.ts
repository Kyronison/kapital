import { createTransport, type Transporter } from 'nodemailer';

export interface Mailer {
  /** html — оформленная версия письма; text остаётся для клиентов без HTML. */
  send(to: string, subject: string, text: string, html?: string): Promise<void>;
}

/** Письма через SMTP: адрес вида smtps://user:pass@smtp.example.com:465 (KAPITAL_SMTP_URL). */
export function smtpMailer(url: string, from: string): Mailer {
  const transport: Transporter = createTransport(url);
  return {
    async send(to, subject, text, html) {
      await transport.sendMail({ from, to, subject, text, html });
    },
  };
}

/** Для разработки: письмо печатается в консоль сервера. */
export function consoleMailer(log: (line: string) => void = console.log): Mailer {
  return {
    async send(to, subject, text) {
      log(`[письмо] кому: ${to}\n${subject}\n${text}`);
    },
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Письмо с кодом: шапка и подвал — картинки с сайта (/art/mail), поэтому нужен публичный адрес.
 * Вёрстка таблицей и инлайн-стилями: так её понимают и Яндекс, и Mail.ru, и Outlook.
 */
export function codeEmailHtml(publicUrl: string, code: string): string {
  const art = (f: string) => `${esc(publicUrl)}/art/mail/${f}`;
  return `<!doctype html><html lang="ru"><body style="margin:0;padding:24px 0;background:#F6F1E7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;color:#1C2321">
<tr><td><img src="${art('mail-header.png')}" width="600" alt="Капитал" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:28px 32px 8px;font-size:16px;line-height:1.5">Ваш код для входа в «Капитал»:</td></tr>
<tr><td style="padding:8px 32px;font-size:36px;font-weight:bold;letter-spacing:8px;color:#0F5C4D">${esc(code)}</td></tr>
<tr><td style="padding:8px 32px 28px;font-size:14px;line-height:1.5;color:#5b6461">Он действует 10 минут. Если вы не запрашивали код, просто не обращайте внимания на это письмо.</td></tr>
<tr><td><img src="${art('mail-footer.png')}" width="600" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>
</table></td></tr></table></body></html>`;
}
