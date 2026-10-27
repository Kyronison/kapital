import { useEffect, useRef, useState, type FormEvent } from 'react';
import { art, Icon } from '../art.js';
import { keepInvite, type AccountApi } from '../auth.js';

type Step = { kind: 'email' } | { kind: 'code'; email: string; needName: boolean } | { kind: 'password' };

declare global {
  interface Window {
    onTelegramAuth?: (data: Record<string, unknown>) => void;
  }
}

/** Экран входа: код из письма (с паролем по желанию), пароль, Google, Яндекс, Telegram. Показываются только настроенные способы. */
export function Login({ auth, invited }: { auth: AccountApi; invited: boolean }) {
  const providers = auth.state.status === 'loading' ? null : auth.state.providers;
  const [step, setStep] = useState<Step>({ kind: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Что-то пошло не так');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind === 'email') {
      void run(async () => {
        await auth.sendCode(email);
        setStep({ kind: 'code', email, needName: false });
      });
    } else if (step.kind === 'code') {
      void run(async () => {
        const ok = await auth.verifyCode(step.email, code, name || undefined, password || undefined);
        if (!ok) setStep({ ...step, needName: true });
      });
    } else {
      void run(() => auth.signInWithPassword(email, password));
    }
  };

  const none = providers && !providers.email && !providers.google && !providers.yandex && !providers.telegram;

  const services = providers && (providers.google || providers.yandex || providers.telegram);
  const locked = error?.startsWith('Слишком много');

  return (
    <main className="login">
      <section className="hero">
        <span className="eyebrow">Финансовая настольная игра</span>
        <h1>{invited ? 'Вас пригласили за стол' : 'Большие планы начинаются с игры'}</h1>
        <p>
          Получите профессию, вкладывайте свободные деньги в активы и выйдите из «Круга забот», когда пассивный
          доход покроет расходы. Побеждает тот, кто первым купит свою мечту.
        </p>
        <p className="muted">Войдите, чтобы партии и прогресс «Тренировки» сохранялись в аккаунте и были доступны с любого устройства.</p>
        <img className="login-hero-art" src={art('login/hero.webp')} alt="" />
      </section>
      <form className="card login-card" onSubmit={submit} aria-busy={busy}>
        <span className="eyebrow">Рады вас видеть</span>
        <h2>Вход</h2>
        {step.kind === 'code' && <img className="login-step-art" src={art('login/code-sent.webp')} alt="" />}
        {services && step.kind === 'email' && (
          <div className="providers">
            {providers.yandex && (
              <a className="kap-button provider provider-yandex" href="/api/auth/oauth/yandex/start">
                <span className="provider-mark" aria-hidden="true">Я</span>
                Войти с Яндекс ID
              </a>
            )}
            {providers.google && <a className="kap-button provider" href="/api/auth/oauth/google/start"><Icon name="ui-user-circle" size={18} />Войти через Google</a>}
            {providers.telegram && <TelegramButton bot={providers.telegram} onAuth={(d) => run(() => auth.signInTelegram(d))} />}
            {providers.email && <span className="or muted">или по почте</span>}
          </div>
        )}
        {providers?.email && step.kind === 'email' && (
          <>
            <label className="field">
              <span>Электронная почта</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <button className="primary big kap-button" type="submit" disabled={busy}>
              <Icon name="ui-mail" />
              Получить код
            </button>
            <button type="button" className="link" onClick={() => setStep({ kind: 'password' })}><Icon name="ui-key" size={16} />У меня есть пароль</button>
          </>
        )}
        {providers?.email && step.kind === 'code' && (
          <>
            <p className="muted"><Icon name="ui-clock" size={16} /> Код отправлен на <strong>{step.email}</strong>. Он действует 10 минут.</p>
            <label className="field">
              <span>Код из письма</span>
              <input inputMode="numeric" pattern="\d{6}" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
            </label>
            {step.needName && (
              <>
                <p className="muted">Это ваш первый вход: как вас называть за столом? Аватар можно выбрать потом в профиле.</p>
                <label className="field">
                  <span>Имя</span>
                  <input required maxLength={24} autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как вас называть" />
                </label>
                <label className="field">
                  <span>Пароль <small className="muted">(необязательно, не короче 8 символов: потом можно входить без письма)</small></span>
                  <PasswordInput autoComplete="new-password" minLength={8} value={password} onChange={setPassword} />
                </label>
              </>
            )}
            <button className="primary big kap-button" type="submit" disabled={busy}><Icon name="ui-check-circle" />Войти</button>
            <button type="button" className="link" onClick={() => { setStep({ kind: 'email' }); setCode(''); }}>Другая почта</button>
          </>
        )}
        {providers?.email && step.kind === 'password' && (
          <>
            <label className="field">
              <span>Электронная почта</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Пароль</span>
              <PasswordInput autoComplete="current-password" required value={password} onChange={setPassword} />
            </label>
            <button className="primary big kap-button" type="submit" disabled={busy}><Icon name="ui-key" />Войти</button>
            <button type="button" className="link" onClick={() => setStep({ kind: 'email' })}><Icon name="ui-mail" size={16} />Войти по коду из письма</button>
          </>
        )}
        {none && <p className="muted">На сервере не настроен ни один способ входа: см. README, раздел «Аккаунты».</p>}
        {error && (
          <div className={`form-error${locked ? ' locked' : ''}`} role="alert">
            {locked && <img src={art('login/locked.webp')} alt="" />}
            <p>{error}</p>
          </div>
        )}
        <p className="consent muted"><Icon name="ui-shield" size={14} /> Для входа мы храним только имя и почту, на серверах в России.</p>
        <img className="login-art" src={art('login/card-art.webp')} alt="" />
      </form>
    </main>
  );
}

/** Пароль с кнопкой «показать». */
function PasswordInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void; autoComplete: string; minLength?: number; required?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="password-input">
      <input type={shown ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      <button type="button" className="ghost" onClick={() => setShown(!shown)} aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={shown}>
        <Icon name={shown ? 'ui-eye-off' : 'ui-eye'} size={18} />
      </button>
    </span>
  );
}

/** Виджет Telegram рисует кнопку сам: его скрипт подключается только когда вход через Telegram настроен. */
function TelegramButton({ bot, onAuth }: { bot: string; onAuth: (data: Record<string, unknown>) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.onTelegramAuth = onAuth;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.dataset.telegramLogin = bot;
    script.dataset.size = 'large';
    script.dataset.onauth = 'onTelegramAuth(user)';
    script.dataset.requestAccess = 'write';
    box.current?.replaceChildren(script);
    return () => {
      delete window.onTelegramAuth;
    };
  }, [bot, onAuth]);
  return <div ref={box} className="telegram-login" />;
}
