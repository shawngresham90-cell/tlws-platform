import { NextResponse } from 'next/server';

/** Consistent JSON envelopes so every handler answers the same shape. */
export function ok(data: unknown = {}, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}
