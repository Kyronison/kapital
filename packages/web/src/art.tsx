import type { CSSProperties } from 'react';

/** Векторная графика вставляется в разметку, чтобы цвет шёл из CSS через currentColor. */
const raw = import.meta.glob<string>('./art/**/*.svg', { query: '?raw', import: 'default', eager: true });

const inline = (svg: string) =>
  svg
    .replace(/\s(role|aria-label|color)="[^"]*"/g, '')
    .replace('<svg ', '<svg aria-hidden="true" focusable="false" ');

const svgs = new Map(Object.entries(raw).map(([path, svg]) => [path.replace('./art/', '').replace('.svg', ''), inline(svg)]));

function Svg({ name, className, style, label }: { name: string; className: string; style?: CSSProperties; label?: string }) {
  const svg = svgs.get(name);
  if (!svg) return null;
  return (
    <span
      className={className}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Иконка из набора: cell-*, asset-*, stock-*, ui-*. */
export const Icon = ({ name, size, label }: { name: string; size?: number; label?: string }) => (
  <Svg name={`icons/${name}`} className="icon" style={size ? { width: size, height: size } : undefined} label={label} />
);

export const Logo = ({ mark = false }: { mark?: boolean }) => (
  <Svg name={mark ? 'brand/logo-mark' : 'brand/logo'} className={mark ? 'logo-mark' : 'logo'} label="Капитал" />
);

export const Token = ({ color, label }: { color: string; label?: string }) => (
  <Svg name="tokens/token" className="token" style={{ color }} label={label} />
);

export const art = (path: string) => `/art/${path}`;

export const PLAYER_COLORS = ['#0F5C4D', '#E3A72F', '#E0604A', '#4A90C2', '#7A4E8C', '#3B4542'];
export const playerColor = (i: number) => PLAYER_COLORS[i % PLAYER_COLORS.length]!;
