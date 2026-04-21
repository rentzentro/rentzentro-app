'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type LandlordRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string;
};

type TeamMembershipRow = {
  id: string;
  owner_user_id: string;
  member_user_id: string | null;
  status: string | null;
};

type ListingRow = {
  id: number;
  title: string;
  slug: string;
  published: boolean | null;
};

type PropertyRow = {
  id: number;
  owner_id: string | null;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
};

type InquiryRow = {
  id: number;
  listing_id: number | null;
  owner_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: string | null;
  created_at: string | null;
};

type LoadStatus = 'loading' | 'ready' | 'error';

const STATUS_OPTIONS = [
  'all',
  'new',
  'contacted',
  'showing_scheduled',
  'converted',
  'closed',
  'archived',
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];

const statusLabel = (value: string | null | undefined) => {
  const s = String(value || 'new').toLowerCase();

  if (s === 'showing_scheduled') return 'Showing scheduled';
  if (s === 'contacted') return 'Contacted';
  if (s === 'converted') return 'Converted';
  if (s === 'closed') return 'Closed';
  if (s === 'archived') return 'Archived';
  return 'New';
};

const statusClasses = (value: string | null | undefined) => {
  const s = String(value || 'new').toLowerCase();

  if (s === 'contacted') {
    return 'border-sky-500/40 bg-sky-500/10 text-sky-100';
  }
  if (s === 'showing_scheduled') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-100';
  }
  if (s === 'converted') {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100';
  }
  if (s === 'closed') {
    return 'border-violet-500/40 bg-violet-500/10 text-violet-100';
  }
  if (s === 'archived') {
    return 'border-slate-700 bg-slate-900 text-slate-300';
  }

  return 'border-rose-500/40 bg-rose-500/10 text-rose-100';
};

const niceDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const toDateInputValue = (iso: string | null | undefined): string => {
  if (!iso) return '';
  return iso.slice(0, 10);
};

const propertyLabel = (property: PropertyRow | null | undefined) => {
  if (!property) return 'Select a property';
  return `${property.name || 'Unnamed property'}${
    property.unit_label ? ` · ${property.unit_label}` : ''
  }`;
};

export default function LandlordInquiriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const listingParam = searchParams.get('listing');

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedListingId, setSelectedListingId] = useState<number | 'all'>(
    listingParam ? Number(listingParam) : 'all'
  );

  const [busyId, setBusyId] = useState<number | null>(null);

  const [convertInquiry, setConvertInquiry] = useState<InquiryRow | null>(null);
  const [convertPropertyId, setConvertPropertyId] = useState<number | ''>('');
  const [convertLeaseStart, setConvertLeaseStart] = useState('');
  const [convertLeaseEnd, setConvertLeaseEnd] = useState('');
  const [convertAllowEarlyPayment, setConvertAllowEarlyPayment] = useState(false);
  const [convertSendingInvite, setConvertSendingInvite] = useState(true);
  const [converting, setConverting] = useState(false);

  const listingMap = useMemo(() => {
    const m = new Map<number, ListingRow>();
    for (const row of listings) m.set(row.id, row);
    return m;
  }, [listings]);

  const propertyMap = useMemo(() => {
    const m = new Map<number, PropertyRow>();
    for (const row of properties) m.set(row.id, row);
    return m;
  }, [properties]);

  const load = useCallback(async () => {
    setLoadStatus('loading');
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.push('/landlord/login');
        return;
      }

      const user = authData.user;

      let resolvedLandlord: LandlordRow | null = null;
      let teamFlag = false;

      const { data: landlordByUser, error: landlordUserError } = await supabase
        .from('landlords')
        .select('id, name, email, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (landlordUserError) {
        console.error('Error loading landlord by user_id:', landlordUserError);
        throw new Error('Unable to load landlord account.');
      }

      if (landlordByUser) {
        resolvedLandlord = landlordByUser as LandlordRow;
        teamFlag = false;
      } else {
        const { data: teamRow, error: teamError } = await supabase
          .from('landlord_team_members')
          .select('id, owner_user_id, member_user_id, status')
          .eq('member_user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (teamError) {
          console.error('Error loading team membership:', teamError);
          throw new Error('Unable to load team membership.');
        }

        if (!teamRow) {
          throw new Error(
            'We could not find an active landlord account or team membership for this login.'
          );
        }

        const typedTeam = teamRow as TeamMembershipRow;
        teamFlag = true;

        const { data: ownerLandlord, error: ownerLandlordError } = await supabase
          .from('landlords')
          .select('id, name, email, user_id')
          .eq('user_id', typedTeam.owner_user_id)
          .maybeSingle();

        if (ownerLandlordError) {
          console.error('Error loading owner landlord account:', ownerLandlordError);
          throw new Error('Unable to load the owner landlord account for this team login.');
        }

        if (!ownerLandlord) {
          throw new Error('Owner landlord account not found for this team member.');
        }

        resolvedLandlord = ownerLandlord as LandlordRow;
      }

      if (!resolvedLandlord) {
        throw new Error('Landlord account not found.');
      }

      setLandlord(resolvedLandlord);
      setIsTeamMember(teamFlag);

      const [listingRowsRes, propertyRowsRes, inquiryRowsRes] = await Promise.all([
        supabase
          .from('listings')
          .select('id, title, slug, published')
          .eq('owner_id', resolvedLandlord.user_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('properties')
          .select('id, owner_id, name, unit_label, monthly_rent, status')
          .eq('owner_id', resolvedLandlord.user_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('listing_inquiries')
          .select('id, listing_id, owner_id, name, email, phone, message, status, created_at')
          .eq('owner_id', resolvedLandlord.user_id)
          .order('created_at', { ascending: false }),
      ]);

      if (listingRowsRes.error) {
        console.error('Error loading listings:', listingRowsRes.error);
        throw new Error('Unable to load listings.');
      }

      if (propertyRowsRes.error) {
        console.error('Error loading properties:', propertyRowsRes.error);
        throw new Error('Unable to load properties.');
      }

      if (inquiryRowsRes.error) {
        console.error('Error loading listing inquiries:', inquiryRowsRes.error);
        throw new Error('Unable to load listing inquiries.');
      }

      setListings((listingRowsRes.data || []) as ListingRow[]);
      setProperties((propertyRowsRes.data || []) as PropertyRow[]);
      setInquiries((inquiryRowsRes.data || []) as InquiryRow[]);
      setLoadStatus('ready');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load inquiries.');
      setLoadStatus('error');
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredInquiries = useMemo(() => {
    const q = search.trim().toLowerCase();

    return inquiries.filter((row) => {
      const rowStatus = String(row.status || 'new').toLowerCase();
      const listing = row.listing_id ? listingMap.get(row.listing_id) : null;

      const matchesStatus = statusFilter === 'all' ? true : rowStatus === statusFilter;

      const matchesListing =
        selectedListingId === 'all' ? true : row.listing_id === selectedListingId;

      const haystack = [
        row.name || '',
        row.email || '',
        row.phone || '',
        row.message || '',
        listing?.title || '',
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = q ? haystack.includes(q) : true;

      return matchesStatus && matchesListing && matchesSearch;
    });
  }, [inquiries, listingMap, search, selectedListingId, statusFilter]);

  const stats = useMemo(() => {
    const total = inquiries.length;
    const newCount = inquiries.filter(
      (x) => String(x.status || 'new').toLowerCase() === 'new'
    ).length;
    const contacted = inquiries.filter(
      (x) => String(x.status || '').toLowerCase() === 'contacted'
    ).length;
    const showing = inquiries.filter(
      (x) => String(x.status || '').toLowerCase() === 'showing_scheduled'
    ).length;
    const converted = inquiries.filter(
      (x) => String(x.status || '').toLowerCase() === 'converted'
    ).length;

    return { total, newCount, contacted, showing, converted };
  }, [inquiries]);

  const updateInquiryStatus = async (id: number, nextStatus: string) => {
    if (busyId) return;

    setBusyId(id);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('listing_inquiries')
        .update({ status: nextStatus })
        .eq('id', id);

      if (error) throw error;

      setInquiries((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                status: nextStatus,
              }
            : row
        )
      );
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to update inquiry status.');
    } finally {
      setBusyId(null);
    }
  };

  const openConvertModal = (row: InquiryRow) => {
    setConvertInquiry(row);
    setConvertPropertyId('');
    setConvertLeaseStart('');
    setConvertLeaseEnd('');
    setConvertAllowEarlyPayment(false);
    setConvertSendingInvite(true);
    setError(null);
    setSuccess(null);
  };

  const closeConvertModal = () => {
    if (converting) return;
    setConvertInquiry(null);
    setConvertPropertyId('');
    setConvertLeaseStart('');
    setConvertLeaseEnd('');
    setConvertAllowEarlyPayment(false);
    setConvertSendingInvite(true);
  };

  const handleConvertInquiry = async () => {
    if (!convertInquiry || !landlord?.user_id) return;

    setConverting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!convertInquiry.email?.trim()) {
        throw new Error('This inquiry does not have an email address.');
      }

      if (!convertPropertyId) {
        throw new Error('Please select a property for this tenant.');
      }

      if (!convertLeaseStart) {
        throw new Error(
          'Lease start / first rent due date is required. For month-to-month, use the first month rent is due.'
        );
      }

      const selectedProperty = propertyMap.get(Number(convertPropertyId));
      if (!selectedProperty) {
        throw new Error('Selected property not found.');
      }

      const existingTenantCheck = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', landlord.user_id)
        .eq('email', convertInquiry.email.trim())
        .maybeSingle();

      if (existingTenantCheck.error) {
        console.error('Error checking existing tenant:', existingTenantCheck.error);
        throw new Error('Unable to verify whether this lead is already a tenant.');
      }

      if (existingTenantCheck.data) {
        throw new Error(
          'A tenant with this email already exists for this landlord. You can send them a portal invite from the tenants page instead.'
        );
      }

      const { data: createdTenant, error: insertError } = await supabase
        .from('tenants')
        .insert({
          owner_id: landlord.user_id,
          name: convertInquiry.name?.trim() || null,
          email: convertInquiry.email.trim(),
          phone: convertInquiry.phone?.trim() || null,
          property_id: Number(convertPropertyId),
          status: 'Current',
          monthly_rent: null,
          lease_start: convertLeaseStart,
          lease_end: convertLeaseEnd || null,
          allow_early_payment: convertAllowEarlyPayment,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error converting inquiry to tenant:', insertError);
        throw new Error(insertError.message || 'Failed to create tenant from inquiry.');
      }

      if (convertSendingInvite) {
        const inviteRes = await fetch('/api/tenant-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantEmail: convertInquiry.email.trim(),
            tenantName: convertInquiry.name,
            propertyName: selectedProperty.name,
            unitLabel: selectedProperty.unit_label,
            landlordName: landlord.name || landlord.email,
          }),
        });

        const inviteJson = await inviteRes.json().catch(() => ({}));

        if (!inviteRes.ok || inviteJson?.error) {
          throw new Error(
            inviteJson?.error ||
              'Tenant was created, but the portal invite email could not be sent.'
          );
        }
      }

      const { error: inquiryUpdateError } = await supabase
        .from('listing_inquiries')
        .update({ status: 'converted' })
        .eq('id', convertInquiry.id);

      if (inquiryUpdateError) {
        console.error('Error updating inquiry to converted:', inquiryUpdateError);
        throw new Error(
          'Tenant was created, but the inquiry status could not be updated.'
        );
      }

      setInquiries((prev) =>
        prev.map((row) =>
          row.id === convertInquiry.id
            ? {
                ...row,
                status: 'converted',
              }
            : row
        )
      );

      setSuccess(
        convertSendingInvite
          ? 'Inquiry converted to tenant and portal invite sent.'
          : 'Inquiry converted to tenant successfully.'
      );

      closeConvertModal();
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to convert inquiry to tenant.');
    } finally {
      setConverting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  if (loadStatus === 'loading') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading inquiries…</p>
      </main>
    );
  }

  if (loadStatus === 'error' && !landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <p className="text-sm text-rose-200">
            {error || 'Landlord account could not be found.'}
          </p>
          <button
            onClick={() => router.push('/landlord/login')}
            className="rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex flex-col gap-3 border-b border-slate-900 pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord dashboard
              </Link>
              <span>/</span>
              <Link href="/landlord/listings" className="hover:text-emerald-400">
                Listings
              </Link>
              <span>/</span>
              <span className="text-slate-300">Inquiries</span>
            </div>

            <h1 className="mt-1 text-lg font-semibold text-slate-50">Listing inquiries</h1>
            <p className="text-[11px] text-slate-400">
              Review leads from your public listing pages, follow up, or convert them into tenants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {landlord && (
              <div className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
                {isTeamMember ? 'Team member for ' : 'Signed in as '}
                <span className="font-medium">
                  {landlord.name || landlord.email || 'linked landlord account'}
                </span>
              </div>
            )}

            <Link
              href="/landlord/tenants"
              className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
            >
              View tenants
            </Link>

            <Link
              href="/landlord/listings"
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
            >
              Back to listings
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-500/70 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
            {success}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total inquiries</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{stats.total}</p>
          </div>

          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4">
            <p className="text-xs uppercase tracking-wide text-rose-200/80">New</p>
            <p className="mt-2 text-2xl font-semibold text-rose-100">{stats.newCount}</p>
          </div>

          <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-4">
            <p className="text-xs uppercase tracking-wide text-sky-200/80">Contacted</p>
            <p className="mt-2 text-2xl font-semibold text-sky-100">{stats.contacted}</p>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-200/80">Showing set</p>
            <p className="mt-2 text-2xl font-semibold text-amber-100">{stats.showing}</p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-200/80">Converted</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-100">{stats.converted}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.9fr_0.7fr]">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-slate-500">
                Search inquiries
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone, message, or listing title"
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-slate-500">
                Filter by listing
              </label>
              <select
                value={selectedListingId}
                onChange={(e) =>
                  setSelectedListingId(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              >
                <option value="all">All listings</option>
                {listings.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-slate-500">
                Filter by status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="showing_scheduled">Showing scheduled</option>
                <option value="converted">Converted</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1">
              Showing {filteredInquiries.length} of {inquiries.length}
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1">
              Reply directly by email or phone
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1">
              Convert qualified leads into tenants here
            </span>
          </div>
        </section>

        <section className="space-y-3">
          {filteredInquiries.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center">
              <p className="text-sm font-semibold text-slate-100">No inquiries found</p>
              <p className="mt-1 text-[13px] text-slate-400">
                When someone submits your public listing inquiry form, it will show here.
              </p>
            </div>
          ) : (
            filteredInquiries.map((row) => {
              const listing = row.listing_id ? listingMap.get(row.listing_id) : null;
              const rowStatus = String(row.status || 'new').toLowerCase();
              const isBusy = busyId === row.id;

              const mailto = `mailto:${encodeURIComponent(
                row.email || ''
              )}?subject=${encodeURIComponent(
                listing ? `Re: ${listing.title}` : 'Rental inquiry'
              )}`;

              return (
                <div
                  key={row.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-50">
                          {row.name || 'Unnamed inquiry'}
                        </p>

                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClasses(
                            rowStatus
                          )}`}
                        >
                          {statusLabel(rowStatus)}
                        </span>
                      </div>

                      <p className="mt-1 text-[12px] text-slate-300">
                        {row.email || 'No email provided'}
                        {row.phone ? ` • ${row.phone}` : ''}
                      </p>

                      <p className="mt-1 text-[11px] text-slate-500">
                        Received {niceDateTime(row.created_at)}
                      </p>

                      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          Listing
                        </p>

                        {listing ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="text-[13px] font-medium text-slate-100">
                              {listing.title}
                            </p>

                            <a
                              href={`/listings/${listing.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-800"
                            >
                              View public page
                            </a>
                          </div>
                        ) : (
                          <p className="mt-1 text-[12px] text-slate-400">
                            Listing not found
                          </p>
                        )}
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          Inquiry message
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-slate-200">
                          {row.message || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="w-full shrink-0 lg:w-[310px]">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Actions
                        </p>

                        <div className="mt-3 grid gap-2">
                          <a
                            href={mailto}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                          >
                            Email lead
                          </a>

                          {row.phone ? (
                            <a
                              href={`tel:${row.phone}`}
                              className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                            >
                              Call lead
                            </a>
                          ) : (
                            <div className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-500">
                              No phone provided
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={
                              rowStatus === 'converted' ||
                              !row.email ||
                              properties.length === 0
                            }
                            onClick={() => openConvertModal(row)}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {rowStatus === 'converted'
                              ? 'Already converted'
                              : 'Convert to tenant'}
                          </button>
                        </div>

                        <div className="mt-4 border-t border-slate-800 pt-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Update status
                          </p>

                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => updateInquiryStatus(row.id, 'new')}
                              className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
                            >
                              Mark new
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => updateInquiryStatus(row.id, 'contacted')}
                              className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/15 disabled:opacity-60"
                            >
                              Contacted
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                updateInquiryStatus(row.id, 'showing_scheduled')
                              }
                              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/15 disabled:opacity-60"
                            >
                              Showing set
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => updateInquiryStatus(row.id, 'closed')}
                              className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/15 disabled:opacity-60"
                            >
                              Closed
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => updateInquiryStatus(row.id, 'archived')}
                            className="mt-2 w-full rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                          >
                            {isBusy ? 'Saving…' : 'Archive'}
                          </button>
                        </div>

                        <p className="mt-4 text-[10px] leading-5 text-slate-500">
                          This is a one-way inquiry inbox. Reply directly by email or phone,
                          or convert qualified leads into tenants.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {convertInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  Convert inquiry
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-50">
                  Convert lead into tenant
                </h2>
                <p className="mt-1 text-[12px] text-slate-400">
                  This will create a tenant using the lead’s contact info and optionally send a portal invite.
                </p>
              </div>

              <button
                type="button"
                onClick={closeConvertModal}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-sm font-semibold text-slate-100">
                {convertInquiry.name || 'Unnamed lead'}
              </p>
              <p className="mt-1 text-[12px] text-slate-300">
                {convertInquiry.email || 'No email'}
                {convertInquiry.phone ? ` • ${convertInquiry.phone}` : ''}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Inquiry received {niceDateTime(convertInquiry.created_at)}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase tracking-wide text-slate-500">
                  Property *
                </label>
                <select
                  value={convertPropertyId === '' ? '' : String(convertPropertyId)}
                  onChange={(e) =>
                    setConvertPropertyId(e.target.value ? Number(e.target.value) : '')
                  }
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                >
                  <option value="">Select a property…</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {propertyLabel(property)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500">
                  Lease start / first due date *
                </label>
                <input
                  type="date"
                  value={convertLeaseStart}
                  onChange={(e) => setConvertLeaseStart(toDateInputValue(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500">
                  Lease end
                </label>
                <input
                  type="date"
                  value={convertLeaseEnd}
                  onChange={(e) => setConvertLeaseEnd(toDateInputValue(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <label className="flex items-center gap-2 text-[12px] text-slate-200">
                <input
                  type="checkbox"
                  checked={convertAllowEarlyPayment}
                  onChange={(e) => setConvertAllowEarlyPayment(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                />
                <span>Allow early rent payment for this tenant</span>
              </label>

              <label className="flex items-center gap-2 text-[12px] text-slate-200">
                <input
                  type="checkbox"
                  checked={convertSendingInvite}
                  onChange={(e) => setConvertSendingInvite(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                />
                <span>Send tenant portal invite email after conversion</span>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeConvertModal}
                disabled={converting}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConvertInquiry}
                disabled={converting}
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {converting ? 'Converting…' : 'Convert to tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}