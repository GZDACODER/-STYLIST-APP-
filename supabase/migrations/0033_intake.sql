-- Step 28: intake forms and liability waivers.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0032_one_plan.sql first. Running this again later is safe.
--
-- Each business can write one intake form (questions) and one waiver, and
-- switch them on for the services that need them (Settings -> Intake form).
-- When a client books one of those services, the booking page asks them to
-- answer the questions and sign the waiver (tick "I agree" and type their
-- full name) before they book. Once is enough: their answers are reused on
-- later bookings, until the business edits the form (a new version) or taps
-- "Ask again" on their client card.
--
-- Each response keeps exactly what the client saw and signed: the questions
-- and answers, the waiver text, the typed name, when, and the IP address and
-- browser it came from.

-- ============ THE FORM ============
create table if not exists public.intake_forms (
  stylist_id uuid primary key references public.stylists (id) on delete cascade,
  -- [{ "id": "q1", "label": "Any allergies?", "type": "text" | "long" | "yesno" | "choice",
  --    "options": ["..."], "required": true }]
  questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 20),
  waiver_text text not null default '' check (char_length(waiver_text) <= 10000),
  -- Goes up by one each time the questions or waiver change, so clients
  -- are asked again.
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.intake_forms enable row level security;

drop policy if exists "Stylists can view own intake form" on public.intake_forms;
create policy "Stylists can view own intake form"
  on public.intake_forms for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own intake form" on public.intake_forms;
create policy "Stylists can add own intake form"
  on public.intake_forms for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own intake form" on public.intake_forms;
create policy "Stylists can update own intake form"
  on public.intake_forms for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

revoke update on public.intake_forms from authenticated;
grant update (questions, waiver_text) on public.intake_forms to authenticated;

create or replace function public.intake_forms_bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.questions is distinct from old.questions or new.waiver_text is distinct from old.waiver_text then
    new.version := old.version + 1;
    new.updated_at := now();
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;

drop trigger if exists intake_forms_bump_version on public.intake_forms;
create trigger intake_forms_bump_version
  before update on public.intake_forms
  for each row execute function public.intake_forms_bump_version();

-- Which services need the form and waiver.
alter table public.services add column if not exists intake_required boolean not null default false;

-- "Ask again": responses from before this are no longer enough.
alter table public.clients add column if not exists intake_redo_at timestamptz;

-- ============ RESPONSES ============
create table if not exists public.intake_responses (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  -- Who answered: their booking-page login, and their proved email / phone.
  user_id uuid,
  email text,
  phone_key text,
  service_id uuid references public.services (id) on delete set null,
  form_version integer not null,
  -- [{ "id", "label", "type", "answer" }] as the client saw them.
  answers jsonb not null default '[]'::jsonb,
  -- The waiver exactly as shown, and the name typed to sign it.
  waiver_text text not null default '',
  signed_name text,
  signed_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists intake_responses_stylist_idx on public.intake_responses (stylist_id, created_at desc);

alter table public.intake_responses enable row level security;

-- A business can read its own clients' responses. Only the booking page's
-- function below adds them; nobody can change or delete one from the app.
drop policy if exists "Stylists can view own intake responses" on public.intake_responses;
create policy "Stylists can view own intake responses"
  on public.intake_responses for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

revoke insert, update, delete on public.intake_responses from anon, authenticated;
grant select on public.intake_responses to authenticated;

-- ============ IS A CURRENT RESPONSE ON FILE? ============
-- For a person (any of login, email, phone) at a business: a response to the
-- current version of the form, made after any "Ask again" on a client card
-- that is this person.
create or replace function public.intake_on_file(
  p_stylist_id uuid,
  p_user_id uuid,
  p_email text,
  p_phone_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.intake_responses r
    join public.intake_forms f on f.stylist_id = r.stylist_id
    where r.stylist_id = p_stylist_id
      and r.form_version = f.version
      and (
        (p_user_id is not null and r.user_id = p_user_id)
        or (p_email is not null and lower(r.email) = lower(p_email))
        or (p_phone_key is not null and r.phone_key = p_phone_key)
      )
      and r.created_at > coalesce(
        (
          select max(c.intake_redo_at)
          from public.clients c
          where c.stylist_id = p_stylist_id
            and (
              (p_email is not null and lower(c.email) = lower(p_email))
              or (p_phone_key is not null and public.phone_key(c.phone) = p_phone_key)
            )
        ),
        '-infinity'::timestamptz
      )
  )
$$;

-- ============ THE BOOKING PAGE ============
-- Does this service need the form for the person looking (their booking-page
-- login)? { needed, questions, waiver_text, version }.
create or replace function public.get_intake(p_slug text, p_service_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_stylist_id uuid;
  v_required boolean;
  v_form public.intake_forms;
begin
  select s.id, sv.intake_required into v_stylist_id, v_required
  from public.stylists s
  join public.services sv on sv.stylist_id = s.id
  where s.slug = lower(p_slug) and sv.id = p_service_id;
  if v_stylist_id is null or not v_required then
    return jsonb_build_object('needed', false);
  end if;

  select * into v_form from public.intake_forms where stylist_id = v_stylist_id;
  if v_form.stylist_id is null
    or (jsonb_array_length(v_form.questions) = 0 and btrim(v_form.waiver_text) = '') then
    return jsonb_build_object('needed', false);
  end if;

  if auth.uid() is not null and public.intake_on_file(
    v_stylist_id, auth.uid(), public.booking_verified_email(), public.booking_verified_phone()
  ) then
    return jsonb_build_object('needed', false);
  end if;

  return jsonb_build_object(
    'needed', true,
    'questions', v_form.questions,
    'waiver_text', v_form.waiver_text,
    'version', v_form.version
  );
end;
$$;

-- Saves the client's answers and signature. p_answers: { "<question id>": "answer" }.
-- p_ip and p_user_agent come from Clientele's server.
create or replace function public.submit_intake(
  p_slug text,
  p_service_id uuid,
  p_answers jsonb,
  p_signed_name text,
  p_ip text default null,
  p_user_agent text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := public.booking_verified_email();
  v_phone text := public.booking_verified_phone();
  v_stylist_id uuid;
  v_form public.intake_forms;
  v_question jsonb;
  v_answer text;
  v_saved jsonb := '[]'::jsonb;
  v_name text := btrim(coalesce(p_signed_name, ''));
  v_waiver text;
begin
  if auth.uid() is null or (v_email is null and v_phone is null) then
    raise exception 'not_verified';
  end if;

  select s.id into v_stylist_id
  from public.stylists s
  join public.services sv on sv.stylist_id = s.id
  where s.slug = lower(p_slug) and sv.id = p_service_id;
  if v_stylist_id is null then
    raise exception 'not_found';
  end if;

  select * into v_form from public.intake_forms where stylist_id = v_stylist_id;
  if v_form.stylist_id is null then
    raise exception 'not_found';
  end if;
  if p_answers is not null and jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_answers';
  end if;

  for v_question in select * from jsonb_array_elements(v_form.questions) loop
    v_answer := btrim(coalesce(p_answers ->> (v_question ->> 'id'), ''));
    if char_length(v_answer) > 2000 then
      raise exception 'answer_too_long';
    end if;
    if coalesce((v_question ->> 'required')::boolean, false) and v_answer = '' then
      raise exception 'answer_required';
    end if;
    v_saved := v_saved || jsonb_build_array(jsonb_build_object(
      'id', v_question ->> 'id',
      'label', v_question ->> 'label',
      'type', v_question ->> 'type',
      'answer', v_answer
    ));
  end loop;

  v_waiver := btrim(v_form.waiver_text);
  if v_waiver <> '' and char_length(v_name) not between 2 and 100 then
    raise exception 'signature_required';
  end if;

  insert into public.intake_responses (
    stylist_id, user_id, email, phone_key, service_id, form_version, answers,
    waiver_text, signed_name, signed_at, ip, user_agent
  ) values (
    v_stylist_id, auth.uid(), v_email, v_phone, p_service_id, v_form.version, v_saved,
    v_form.waiver_text,
    case when v_waiver <> '' then v_name end,
    case when v_waiver <> '' then now() end,
    left(p_ip, 100),
    left(p_user_agent, 300)
  );
end;
$$;

-- ============ FOR THE BUSINESS ============
-- The newest response from the person on one of the business's client
-- cards, and whether it's current: { on_file, response } (response may be null).
create or replace function public.client_intake(p_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_key text;
  v_latest public.intake_responses;
begin
  select * into v_client from public.clients where id = p_client_id and stylist_id = auth.uid();
  if not found then
    raise exception 'not_found';
  end if;
  v_key := public.phone_key(v_client.phone);

  select r.* into v_latest
  from public.intake_responses r
  where r.stylist_id = v_client.stylist_id
    and (
      (v_client.email is not null and lower(r.email) = lower(v_client.email))
      or (v_key is not null and r.phone_key = v_key)
      or r.user_id in (
        select b.booked_by from public.bookings b
        where b.client_id = v_client.id and b.booked_by is not null
      )
    )
  order by r.created_at desc
  limit 1;

  return jsonb_build_object(
    'on_file', v_latest.id is not null and public.intake_on_file(
      v_client.stylist_id, v_latest.user_id, coalesce(v_client.email, v_latest.email), coalesce(v_key, v_latest.phone_key)
    ),
    'redo_at', v_client.intake_redo_at,
    'response', case when v_latest.id is null then null else to_jsonb(v_latest) - 'ip' - 'user_agent' end
  );
end;
$$;

-- For the Calendar: is a current response on file for each of these bookings?
create or replace function public.bookings_intake(p_booking_ids uuid[])
returns table (booking_id uuid, needed boolean, on_file boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id,
    coalesce(sv.intake_required, false),
    public.intake_on_file(b.stylist_id, b.booked_by, nullif(b.client_email, ''), public.phone_key(b.client_phone))
  from public.bookings b
  left join public.services sv on sv.id = b.service_id
  where b.id = any(p_booking_ids)
    and b.stylist_id = auth.uid()
$$;

-- ============ WHO CAN CALL WHAT ============
revoke execute on function public.intake_on_file(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.intake_forms_bump_version() from public, anon, authenticated;
revoke execute on function public.get_intake(text, uuid) from public;
revoke execute on function public.submit_intake(text, uuid, jsonb, text, text, text) from public;
grant execute on function public.get_intake(text, uuid) to anon, authenticated;
grant execute on function public.submit_intake(text, uuid, jsonb, text, text, text) to anon, authenticated;
revoke execute on function public.client_intake(uuid) from public, anon;
revoke execute on function public.bookings_intake(uuid[]) from public, anon;
grant execute on function public.client_intake(uuid) to authenticated;
grant execute on function public.bookings_intake(uuid[]) to authenticated;
