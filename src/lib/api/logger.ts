/**
 * Minimal structured logger. Server-side only. Emits JSON lines so Netlify
 * function logs stay grep-able. No PII in messages — reference IDs, not emails.
 */
type Level = 'info' | 'warn' | 'error';

function emit(level: Level, event: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...meta });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, meta?: Record<string, unknown>) => emit('info', event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => emit('warn', event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit('error', event, meta),
};
