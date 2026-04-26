// app/login/page.tsx
import Link from 'next/link';
import BrandWordmark from '../components/BrandWordmark';

export const metadata = {
  title: 'Log in | RentZentro',
  description:
    'Choose how you want to log in to RentZentro as a landlord, tenant, or team member.',
};

function LoginCard({
  title,
  description,
  href,
  buttonText,
  accent = 'default',
}: {
  title: string;
  description: string;
  href: string;
  buttonText: string;
  accent?: 'default' | 'emerald';
}) {
  const buttonClass =
    accent === 'emerald'
      ? 'rz-btn-primary'
      : 'rz-btn-secondary';

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-slate-900/70">
      <p className="text-lg font-semibold text-slate-50">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>

      <Link
        href={href}
        className={`mt-5 ${buttonClass}`}
      >
        {buttonText}
      </Link>
    </div>
  );
}

export default function LoginChooserPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-5 lg:px-6">
        <div className="mb-4">
          <Link
            href="/"
            className="rz-btn-nav"
          >
            ← Back to homepage
          </Link>
        </div>

        <div className="mb-8 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 p-6 sm:p-8">
          <BrandWordmark
            subtitle="Choose the right login for your account"
            iconClassName="h-11 w-11 rounded-xl text-lg bg-emerald-500/15 ring-emerald-500/30"
            titleClassName="text-sm"
          />

          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Log in to RentZentro
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Select your account type below. Landlords, tenants, and team members each
            have their own login flow.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <LoginCard
            title="Landlord"
            description="Access your landlord dashboard to collect rent, manage properties, track expenses, and view your portfolio."
            href="/landlord/login"
            buttonText="Log in as landlord"
            accent="emerald"
          />

          <LoginCard
            title="Tenant"
            description="Log in to pay rent, view documents, submit maintenance requests, and access your tenant portal."
            href="/tenant/login"
            buttonText="Log in as tenant"
          />

          <LoginCard
            title="Team member"
            description="Use your invited team account to help manage your landlord’s RentZentro dashboard and workflows."
            href="/team/login"
            buttonText="Log in as team member"
          />
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 sm:p-6">
          <p className="text-sm font-semibold text-slate-50">Need an account instead?</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/landlord/signup"
              className="rz-btn-primary"
            >
              Create landlord account
            </Link>

            <Link
              href="/tenant/signup"
              className="rz-btn-secondary"
            >
              Create tenant account
            </Link>
          </div>

          <p className="mt-4 text-[12px] leading-5 text-slate-500">
            Team members usually receive an invite first. If you were invited as a team member,
            use the email from your invite to log in.
          </p>
        </section>
      </div>
    </main>
  );
}
