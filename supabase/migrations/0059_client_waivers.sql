-- Step 55: client waivers, layer 2 (clients sign the pro's waiver).
-- Builds on the intake form (0033_intake.sql), which already keeps the
-- exact waiver text, its version, the typed name, time, IP and device.
--
-- intake_forms.waiver_frequency: 'first' (once), 'every' (each visit) or
--   'yearly'. intake_forms.waiver_timing: 'booking' (must sign to book, as
--   before) or 'before' (booking goes ahead; the client signs from their
--   "Manage my appointment" link and the pro sees "Waiver needed").
-- intake_responses: the drawn signature, a PDF copy, the visit it was for,
--   and a parent or guardian signing for someone under 18.
-- NOTE: the starter waivers are templates; a lawyer must review them.
-- Safe to run more than once.

alter table public.intake_forms add column if not exists waiver_frequency text not null default 'first';
alter table public.intake_forms add column if not exists waiver_timing text not null default 'booking';
alter table public.intake_forms drop constraint if exists intake_forms_waiver_frequency_check;
alter table public.intake_forms add constraint intake_forms_waiver_frequency_check check (waiver_frequency in ('first', 'every', 'yearly'));
alter table public.intake_forms drop constraint if exists intake_forms_waiver_timing_check;
alter table public.intake_forms add constraint intake_forms_waiver_timing_check check (waiver_timing in ('booking', 'before'));

alter table public.intake_responses add column if not exists signature_path text;
alter table public.intake_responses add column if not exists pdf_path text;
alter table public.intake_responses add column if not exists booking_id uuid references public.bookings (id) on delete set null;
alter table public.intake_responses add column if not exists for_minor boolean not null default false;
alter table public.intake_responses add column if not exists guardian_name text;
alter table public.intake_responses add column if not exists guardian_relation text;

-- Private storage for client signature images and PDFs.
insert into storage.buckets (id, name, public) values ('waivers', 'waivers', false) on conflict (id) do nothing;

-- On file = a response to the current version, newer than any "ask again",
-- and recent enough for the pro's rule: once ('first'), within a year
-- ('yearly'), or for this very visit ('every', checked with p_booking_id).
create or replace function public.intake_on_file_for(
  p_stylist_id uuid, p_user_id uuid, p_email text, p_phone_key text, p_booking_id uuid default null
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
      and (
        f.waiver_frequency = 'first'
        or (f.waiver_frequency = 'yearly' and r.created_at > now() - interval '1 year')
        or (f.waiver_frequency = 'every' and p_booking_id is not null and r.booking_id = p_booking_id)
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

-- The booking page: the form for a service, unless it's on file or the
-- pro asks for it before the visit instead of at booking.
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
    or (jsonb_array_length(v_form.questions) = 0 and btrim(v_form.waiver_text) = '')
    or v_form.waiver_timing = 'before' then
    return jsonb_build_object('needed', false);
  end if;
  if v_form.waiver_frequency <> 'every' and auth.uid() is not null and public.intake_on_file_for(
    v_stylist_id, auth.uid(), public.booking_verified_email(), public.booking_verified_phone()
  ) then
    return jsonb_build_object('needed', false);
  end if;
  return jsonb_build_object('needed', true, 'questions', v_form.questions, 'waiver_text', v_form.waiver_text, 'version', v_form.version);
end;
$$;

-- The server adds the drawn signature, guardian details and PDF after a
-- booking-page intake is saved (it has the response's id).
create or replace function public.intake_attach_signature(
  p_response_id uuid, p_signature_path text, p_pdf_path text,
  p_for_minor boolean, p_guardian_name text, p_guardian_relation text, p_booking_id uuid
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.intake_responses set
    signature_path = coalesce(signature_path, p_signature_path),
    pdf_path = coalesce(pdf_path, p_pdf_path),
    for_minor = p_for_minor,
    guardian_name = nullif(left(btrim(coalesce(p_guardian_name, '')), 100), ''),
    guardian_relation = nullif(left(btrim(coalesce(p_guardian_relation, '')), 40), ''),
    booking_id = coalesce(booking_id, p_booking_id)
  where id = p_response_id
$$;
revoke all on function public.intake_attach_signature(uuid, text, text, boolean, text, text, uuid) from public, anon, authenticated;
grant execute on function public.intake_attach_signature(uuid, text, text, boolean, text, text, uuid) to service_role;

-- From the "Manage my appointment" link: the form, and whether it's needed.
create or replace function public.waiver_for_visit(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  f public.intake_forms;
  v_needs boolean;
begin
  if p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into b from public.bookings where cancel_token = p_token;
  if b.id is null then return null; end if;
  select * into f from public.intake_forms where stylist_id = b.stylist_id;
  if f.stylist_id is null or (jsonb_array_length(f.questions) = 0 and btrim(f.waiver_text) = '') then
    return jsonb_build_object('needed', false, 'has_form', false);
  end if;
  -- Only for services that ask for the form.
  if b.service_id is not null and not exists (select 1 from public.services where id = b.service_id and intake_required) then
    return jsonb_build_object('needed', false, 'has_form', false);
  end if;
  v_needs := not public.intake_on_file_for(b.stylist_id, null, b.client_email, public.phone_key(b.client_phone), b.id);
  return jsonb_build_object(
    'needed', v_needs, 'has_form', true, 'questions', f.questions, 'waiver_text', f.waiver_text,
    'version', f.version, 'stylist_id', b.stylist_id, 'booking_id', b.id
  );
end;
$$;
revoke all on function public.waiver_for_visit(text) from public, anon, authenticated;
grant execute on function public.waiver_for_visit(text) to service_role;

-- Signing from the link: saves the response for that visit's client.
create or replace function public.submit_waiver_for_visit(
  p_token text, p_answers jsonb, p_signed_name text, p_signature_path text,
  p_for_minor boolean, p_guardian_name text, p_guardian_relation text, p_ip text, p_user_agent text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  f public.intake_forms;
  v_question jsonb;
  v_answer text;
  v_saved jsonb := '[]'::jsonb;
  v_name text := btrim(coalesce(p_signed_name, ''));
  v_id uuid;
begin
  if p_token !~ '^[0-9a-f]{64}$' then raise exception 'not_found'; end if;
  select * into b from public.bookings where cancel_token = p_token and status = 'confirmed';
  if b.id is null then raise exception 'not_found'; end if;
  select * into f from public.intake_forms where stylist_id = b.stylist_id;
  if f.stylist_id is null then raise exception 'not_found'; end if;
  for v_question in select * from jsonb_array_elements(f.questions) loop
    v_answer := btrim(coalesce(p_answers ->> (v_question ->> 'id'), ''));
    if char_length(v_answer) > 2000 then raise exception 'answer_too_long'; end if;
    if coalesce((v_question ->> 'required')::boolean, false) and v_answer = '' then raise exception 'answer_required'; end if;
    v_saved := v_saved || jsonb_build_array(jsonb_build_object('id', v_question ->> 'id', 'label', v_question ->> 'label', 'type', v_question ->> 'type', 'answer', v_answer));
  end loop;
  if btrim(f.waiver_text) <> '' and (char_length(v_name) not between 2 and 100 or coalesce(p_signature_path, '') = '') then
    raise exception 'signature_required';
  end if;
  if p_for_minor and char_length(btrim(coalesce(p_guardian_name, ''))) < 2 then raise exception 'guardian_required'; end if;
  insert into public.intake_responses (
    stylist_id, email, phone_key, service_id, form_version, answers, waiver_text, signed_name, signed_at,
    ip, user_agent, signature_path, booking_id, for_minor, guardian_name, guardian_relation
  ) values (
    b.stylist_id, b.client_email, public.phone_key(b.client_phone), b.service_id, f.version, v_saved, f.waiver_text,
    case when btrim(f.waiver_text) <> '' then v_name end, case when btrim(f.waiver_text) <> '' then now() end,
    left(p_ip, 100), left(p_user_agent, 300), p_signature_path, b.id, coalesce(p_for_minor, false),
    nullif(left(btrim(coalesce(p_guardian_name, '')), 100), ''), nullif(left(btrim(coalesce(p_guardian_relation, '')), 40), '')
  ) returning id into v_id;
  insert into public.client_activity (stylist_id, booking_id, client_name, action, detail)
  values (b.stylist_id, b.id, b.client_name, 'waiver_signed', null);
  return v_id;
end;
$$;
revoke all on function public.submit_waiver_for_visit(text, jsonb, text, text, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_waiver_for_visit(text, jsonb, text, text, boolean, text, text, text, text) to service_role;

-- For the pro's calendar: which of these bookings still need the waiver.
create or replace function public.bookings_missing_waiver(p_booking_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.bookings b
  join public.intake_forms f on f.stylist_id = b.stylist_id
  join public.services sv on sv.id = b.service_id and sv.intake_required
  where b.id = any (p_booking_ids)
    and b.stylist_id = (select auth.uid())
    and b.status = 'confirmed'
    and btrim(f.waiver_text) <> ''
    and not public.intake_on_file_for(b.stylist_id, null, b.client_email, public.phone_key(b.client_phone), b.id)
$$;
grant execute on function public.bookings_missing_waiver(uuid[]) to authenticated;

-- Pros can change these two settings on their own form.
grant update (waiver_frequency, waiver_timing) on public.intake_forms to authenticated;
grant insert (waiver_frequency, waiver_timing) on public.intake_forms to authenticated;
