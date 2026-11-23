-- Step 58: public reviews. Built on visit_feedback (the stars clients leave
-- after a visit). Written reviews are private until the pro approves them;
-- the pro can reply publicly; anyone can report a review, and the Clientele
-- team can hide it (Control Room > Reviews).

alter table public.visit_feedback add column if not exists is_public boolean not null default false;
alter table public.visit_feedback add column if not exists reply text;
alter table public.visit_feedback add column if not exists replied_at timestamptz;
alter table public.visit_feedback add column if not exists hidden boolean not null default false;
alter table public.visit_feedback add column if not exists updated_at timestamptz;
do $$ begin
  alter table public.visit_feedback add constraint visit_feedback_reply_length check (reply is null or char_length(reply) <= 1000);
exception when duplicate_object then null; end $$;

-- Pros approve and reply to their own reviews.
grant update (is_public, reply, replied_at) on public.visit_feedback to authenticated;
drop policy if exists "Pros answer their feedback" on public.visit_feedback;
create policy "Pros answer their feedback" on public.visit_feedback for update to authenticated
  using ((select auth.uid()) = stylist_id) with check ((select auth.uid()) = stylist_id);

-- Only a visit that went ahead and has ended can be reviewed.
create or replace function public.visit_completed(b public.bookings)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select b.status = 'confirmed'
    and coalesce(b.outcome, '') not in ('no_show', 'replaced')
    and ((b.booking_date + b.end_time) at time zone coalesce(
          (select s.timezone from public.stylists s where s.id = b.stylist_id), 'America/Chicago')) < now();
$$;
revoke execute on function public.visit_completed(public.bookings) from public, anon, authenticated;

create or replace function public.client_leave_feedback(p_code text, p_booking_id uuid, p_rating integer, p_comment text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.stylists;
  b public.bookings;
begin
  select * into s from public.stylists where pro_code = public.clean_pro_code(p_code);
  select * into b from public.bookings where id = p_booking_id and stylist_id = s.id;
  if b.id is null or not public.is_my_booking(b) then raise exception 'not_found'; end if;
  if not public.visit_completed(b) then raise exception 'not_completed'; end if;
  if p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
  insert into public.visit_feedback (booking_id, stylist_id, client_id, rating, comment)
  values (b.id, s.id, b.client_id, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''))
  on conflict (booking_id) do update set rating = excluded.rating,
    comment = coalesce(excluded.comment, public.visit_feedback.comment),
    -- A changed review goes back to the pro for approval.
    is_public = public.visit_feedback.is_public and excluded.rating = public.visit_feedback.rating
      and coalesce(excluded.comment, public.visit_feedback.comment) is not distinct from public.visit_feedback.comment,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.feedback_by_token(p_token text, p_rating integer, p_comment text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where cancel_token = p_token;
  if b.id is null then raise exception 'not_found'; end if;
  if not public.visit_completed(b) then raise exception 'not_completed'; end if;
  if p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
  insert into public.visit_feedback (booking_id, stylist_id, client_id, rating, comment)
  values (b.id, b.stylist_id, b.client_id, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''))
  on conflict (booking_id) do update set rating = excluded.rating,
    comment = coalesce(excluded.comment, public.visit_feedback.comment),
    is_public = public.visit_feedback.is_public and excluded.rating = public.visit_feedback.rating
      and coalesce(excluded.comment, public.visit_feedback.comment) is not distinct from public.visit_feedback.comment,
    updated_at = now();
  return true;
end;
$$;

-- Reports of fake or abusive reviews. Written by the server only.
create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.visit_feedback (booking_id) on delete cascade,
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  reason text not null check (reason in ('fake', 'abusive', 'private_info', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  reporter text check (reporter is null or char_length(reporter) <= 200),
  status text not null default 'open' check (status in ('open', 'hidden', 'kept')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists review_reports_open_idx on public.review_reports (created_at desc) where status = 'open';
alter table public.review_reports enable row level security;
revoke all on public.review_reports from anon, authenticated;
