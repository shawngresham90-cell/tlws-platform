import { signIn } from '@/app/auth/actions';
import { Container } from '@/components/ui';

const ERRORS: Record<string, string> = {
  invalid: 'That email or password is wrong. Try again.',
  missing: 'Enter both email and password.',
  not_authorized: 'That account has no admin access.',
};

export const metadata = { title: 'Sign in' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const error = searchParams.error ? ERRORS[searchParams.error] : null;
  const next = searchParams.next ?? '/admin';

  return (
    <div className="flex min-h-[70vh] items-center justify-center py-16">
      <Container className="max-w-md">
        <p className="eyebrow mb-3">Trucking Life · Admin</p>
        <h1 className="display-section mb-8">Sign in</h1>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-ink"
          >
            {error}
          </div>
        )}

        {/* Server action — no client JS needed for the core flow */}
        <form action={signIn} className="space-y-5">
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-muted">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-ink outline-none focus:border-signal"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-muted">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-ink outline-none focus:border-signal"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-card bg-signal px-6 py-3 font-display text-lg uppercase text-asphalt transition-colors hover:bg-signal-600"
          >
            Sign in
          </button>
        </form>
      </Container>
    </div>
  );
}
