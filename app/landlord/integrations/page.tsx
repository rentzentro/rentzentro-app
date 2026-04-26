'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { integrationCards } from '../../lib/integrationsCatalog';

type LandlordRow = {
  id: number;
  user_id: string | null;
  email: string;
};

export default function LandlordIntegrationsPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  useEffect(() => {
    const provider = searchParams.get('provider');
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    const realmId = searchParams.get('realmId');

    if (provider !== 'quickbooks' || !status) return;

    if (status === 'success') {
      setNotice(
        message || (realmId ? `QuickBooks connected (realm: ${realmId}).` : 'QuickBooks connected.')
      );
      setError(null);
      return;
    }

    setError(message || 'QuickBooks connection failed.');
  }, [searchParams]);

  useEffect(() => {
    const loadLandlord = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          throw new Error('Please log in again to access integrations.');
        }

        const user = authData.user;

        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, user_id, email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (landlordError) throw landlordError;

        if (!landlordRow && user.email) {
          const { data: byEmail, error: byEmailError } = await supabase
            .from('landlords')
            .select('id, user_id, email')
            .eq('email', user.email)
            .maybeSingle();

          if (byEmailError) throw byEmailError;
          if (byEmail) {
            setLandlord(byEmail as LandlordRow);
            return;
          }
        }

        if (!landlordRow) throw new Error('Landlord account not found.');
        setLandlord(landlordRow as LandlordRow);
      } catch (err: any) {
        setError(err?.message || 'Unable to load integrations.');
      } finally {
        setLoading(false);
      }
    };

    loadLandlord();
  }, []);

  const startIntegration = async (provider: string) => {
    if (!landlord) return;

    setBusyProvider(provider);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/integrations/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ provider, landlordId: landlord.id }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) {
        throw new Error(body?.error || 'Unable to start this integration right now.');
      }

      window.location.href = body.url as string;
    } catch (err: any) {
      setError(err?.message || 'Unable to start this integration right now.');
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Integrations</h1>
              <p className="mt-2 text-sm text-slate-300">
                Connect operational systems that reduce manual work and switching costs across
                accounting, screening, documents, and banking.
              </p>
            </div>
            <Link href="/landlord" className="rz-btn-nav">
              Back to dashboard
            </Link>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {landlord ? `Connected landlord account: ${landlord.email}` : 'Loading account context...'}
          </p>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Loading integrations...
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-rose-700/60 bg-rose-950/40 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {notice ? (
          <section className="rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm text-emerald-100">
            {notice}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          {integrationCards.map((integration) => (
            <article
              key={integration.provider}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/20"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-50">{integration.name}</p>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
                  {integration.statusLabel}
                </span>
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                {integration.category}
              </p>
              <p className="mt-3 text-[13px] leading-6 text-slate-300">{integration.summary}</p>

              <ul className="mt-3 space-y-2 text-[12px] text-slate-300">
                {integration.outcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-2">
                    <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] text-emerald-300">
                      ✓
                    </span>
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startIntegration(integration.provider)}
                  disabled={loading || !landlord || busyProvider === integration.provider}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition duration-200 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyProvider === integration.provider
                    ? 'Opening…'
                    : `Connect ${integration.name}`}
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
