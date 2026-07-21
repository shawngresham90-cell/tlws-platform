'use client';

import { useState } from 'react';
import type { AuthStatus, SyncStatus } from './useCloudSync';

/**
 * Account + sync UI (End-User Accounts milestone). Minimal, mobile-first, and
 * NEVER account-gates the planner — signed-out drivers keep using the local
 * store. Public sign-in is email OTP (a code), kept separate from admin login.
 * Explains clearly that saved trips + presets sync to the account while recent
 * searches stay on the device.
 */

const card = 'mt-6 rounded-card border border-line bg-asphalt-800 p-4';
const input =
  'w-full rounded-card border border-line bg-asphalt-900 px-4 py-3 text-base text-ink ' +
  'focus:border-signal focus:outline-none';
const btnPrimary =
  'min-h-[44px] rounded-card bg-signal px-4 py-3 text-sm font-semibold uppercase tracking-wide ' +
  'text-asphalt transition-colors hover:bg-signal-600 disabled:opacity-50';
const btnGhost =
  'min-h-[44px] rounded-card border border-line px-4 py-3 text-sm font-semibold uppercase ' +
  'tracking-wide text-ink transition-colors hover:bg-asphalt-700 disabled:opacity-50';
const btnDanger =
  'min-h-[44px] rounded-card border border-diesel px-4 py-3 text-sm font-semibold uppercase ' +
  'tracking-wide text-diesel-300 transition-colors hover:bg-diesel/10 disabled:opacity-50';

const SYNC_LABEL: Record<SyncStatus, string> = {
  idle: 'Saved on this device',
  syncing: 'Syncing…',
  synced: 'Synced to your account',
  offline: 'Offline — will sync when back online',
  error: 'Sync failed — saved locally, will retry',
};
const SYNC_DOT: Record<SyncStatus, string> = {
  idle: 'bg-muted',
  syncing: 'bg-signal animate-pulse',
  synced: 'bg-green-500',
  offline: 'bg-diesel',
  error: 'bg-diesel',
};

export function AccountPanel({
  authStatus,
  email,
  syncStatus,
  sendOtp,
  verifyOtp,
  signOut,
  syncNow,
  deleteAllCloud,
}: {
  authStatus: AuthStatus;
  email: string | null;
  syncStatus: SyncStatus;
  sendOtp: (email: string) => Promise<{ ok: boolean; message?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  deleteAllCloud: () => Promise<{ ok: boolean }>;
}) {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [addr, setAddr] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doSend = async () => {
    setBusy(true);
    setMsg(null);
    const r = await sendOtp(addr);
    setBusy(false);
    if (r.ok) {
      setStage('code');
      setMsg({ kind: 'ok', text: `We emailed a 6-digit code to ${addr.trim()}.` });
    } else {
      setMsg({ kind: 'error', text: r.message ?? 'Could not send the code.' });
    }
  };
  const doVerify = async () => {
    setBusy(true);
    setMsg(null);
    const r = await verifyOtp(addr, code);
    setBusy(false);
    if (!r.ok) setMsg({ kind: 'error', text: r.message ?? 'That code did not work.' });
    // On success the auth listener flips the panel to signed-in.
  };

  if (authStatus === 'loading') {
    return (
      <section className={card} aria-busy="true">
        <p className="text-sm text-muted">Checking your account…</p>
      </section>
    );
  }

  if (authStatus === 'signed-in') {
    return (
      <section className={card} aria-label="Account and sync">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg uppercase text-ink">Account</h2>
            <p className="text-xs text-muted">{email}</p>
          </div>
          <button type="button" className={btnGhost} onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-ink">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${SYNC_DOT[syncStatus]}`}
            aria-hidden
          />
          <span role="status">{SYNC_LABEL[syncStatus]}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          Your saved trips and truck presets sync across devices. Recent searches stay on this
          device only.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => void syncNow()}>
            Sync now
          </button>
          {confirmDelete ? (
            <>
              <button
                type="button"
                className={btnDanger}
                onClick={async () => {
                  const r = await deleteAllCloud();
                  setConfirmDelete(false);
                  setMsg(
                    r.ok
                      ? { kind: 'ok', text: 'Deleted your cloud copy. Local trips are still here.' }
                      : { kind: 'error', text: 'Could not delete cloud data. Try again.' },
                  );
                }}
              >
                Confirm delete cloud data
              </button>
              <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className={btnDanger} onClick={() => setConfirmDelete(true)}>
              Delete cloud data
            </button>
          )}
        </div>
        {msg && (
          <p
            role={msg.kind === 'error' ? 'alert' : 'status'}
            className={`mt-3 text-sm ${msg.kind === 'error' ? 'text-diesel-300' : 'text-signal'}`}
          >
            {msg.text}
          </p>
        )}
      </section>
    );
  }

  // signed-out
  return (
    <section className={card} aria-label="Sign in to sync">
      <h2 className="font-display text-lg uppercase text-ink">Sync across devices</h2>
      <p className="mt-1 text-xs text-muted">
        Optional — the planner works without an account. Sign in to sync your saved trips and truck
        presets to every device. Recent searches always stay on this device.
      </p>
      {stage === 'email' ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (addr.trim()) void doSend();
          }}
        >
          <label className="text-sm text-ink" htmlFor="tp-acct-email">
            Email
          </label>
          <input
            id="tp-acct-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className={input}
            placeholder="you@example.com"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
          />
          <button type="submit" className={btnPrimary} disabled={busy || !addr.trim()}>
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
        </form>
      ) : (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void doVerify();
          }}
        >
          <label className="text-sm text-ink" htmlFor="tp-acct-code">
            6-digit code
          </label>
          <input
            id="tp-acct-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={input}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary} disabled={busy || !code.trim()}>
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setStage('email');
                setCode('');
                setMsg(null);
              }}
            >
              Use a different email
            </button>
          </div>
        </form>
      )}
      {msg && (
        <p
          role={msg.kind === 'error' ? 'alert' : 'status'}
          className={`mt-3 text-sm ${msg.kind === 'error' ? 'text-diesel-300' : 'text-signal'}`}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}
