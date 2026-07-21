import { redirect } from 'next/navigation';
import { Container, Button } from '@/components/ui';
import { loginAction } from '@/app/admin/actions';
import { adminConfigured, isAdminAuthed } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  if (isAdminAuthed()) redirect('/admin');
  const configured = adminConfigured();
  const error = typeof searchParams?.error === 'string' ? searchParams.error : undefined;

  return (
    <Container className="py-20">
      <div className="mx-auto max-w-sm rounded-card border border-line bg-asphalt-800 p-8">
        <h1 className="display-section mb-1 text-2xl">
          Admin<span className="text-signal">.</span>
        </h1>
        <p className="mb-6 text-sm text-muted">Trucking Life Academy — staff only.</p>

        {!configured && (
          <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
            Admin isn’t configured yet. Set <code>ADMIN_PASSWORD</code> and{' '}
            <code>ADMIN_SESSION_SECRET</code> in the environment.
          </p>
        )}
        {configured && (error === '1' || error === 'notconfigured') && (
          <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
            Incorrect password. Try again.
          </p>
        )}

        <form action={loginAction} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
            />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </Container>
  );
}
