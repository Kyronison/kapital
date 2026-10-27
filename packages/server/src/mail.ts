import { createTransport, type Transporter } from 'nodemailer';

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** Письма через SMTP: адрес вида smtps://user:pass@smtp.example.com:465 (KAPITAL_SMTP_URL). */
export function smtpMailer(url: string, from: string): Mailer {
  const transport: Transporter = createTransport(url);
  return {
    async send(to, subject, text) {
      await transport.sendMail({ from, to, subject, text });
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
