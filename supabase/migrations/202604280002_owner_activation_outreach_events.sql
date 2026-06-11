-- Track owner activation outreach sends so landlords can be snoozed before follow-up.

create table if not exists public.owner_activation_outreach_events (
  id uuid primary key default gen_random_uuid(),
  landlord_id bigint not null references public.landlords(id) on delete cascade,
  landlord_user_id uuid,
  recipient_email text not null,
  sender_key text not null check (sender_key in ('support', 'bradley')),
  sender_label text not null,
  resend_message_id text,
  missing_property boolean not null default false,
  missing_tenant boolean not null default false,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists owner_activation_outreach_events_landlord_sent_idx
  on public.owner_activation_outreach_events (landlord_id, sent_at desc);

create index if not exists owner_activation_outreach_events_sent_idx
  on public.owner_activation_outreach_events (sent_at desc);

alter table public.owner_activation_outreach_events enable row level security;

-- Owner dashboard access goes through server routes using the service role key.
-- Keep direct client access closed by omitting authenticated select/insert policies.
