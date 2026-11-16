-- Step 32: the intake form and waiver on waitlist "Claim this time" bookings.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0036_standing_skip_events.sql first. Running this again later is safe.
--
-- Clients claim a waitlist time from the link in their email, often without
-- being logged in on that phone. The claim link itself shows who they are:
-- it was sent to them, and their waitlist entry holds the login and the
-- email or phone they proved when they joined. So for a service that needs
-- the intake form (step 28), the claim page asks for it, and saves it for
-- that person, exactly as if they'd filled it in on the booking page. It
-- then counts for their later bookings too.

-- ============ DOES THIS CLAIM NEED THE FORM? ============
-- { needed, questions, waiver_text, version } for the person on this claim
-- link, or { needed: false }.
create or replace function public.get_claim_intake(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_offer public.waitlist_offers;
  v_entry public.waitlist_entries;
  v_required boolean;
  v_form public.intake_forms;
begin
  select * into v_offer from public.waitlist_offers where claim_token = p_token;
  if not found then
    return jsonb_build_object('needed', false);
  end if;
  select * into v_entry from public.waitlist_entries where id = v_offer.entry_id;
  select sv.intake_required into v_required from public.services sv where sv.id = v_entry.service_id;
  if not coalesce(v_required, false) then
    return jsonb_build_object('needed', false);
  end if;

  select * into v_form from public.intake_forms where stylist_id = v_offer.stylist_id;
  if v_form.stylist_id is null
    or (jsonb_array_length(v_form.questions) = 0 and btrim(v_form.waiver_text) = '') then
    return jsonb_build_object('needed', false);
  end if;

  if public.intake_on_file(
    v_offer.stylist_id, v_entry.user_id, lower(nullif(v_entry.verified_email, '')),
    public.phone_key(v_entry.verified_phone)
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

-- ============ SAVE THE FORM FROM A CLAIM LINK ============
-- Same checks as submit_intake (step 28): required answers, the typed
-- name to sign. Only while their waitlist entry is still waiting.
create or replace function public.submit_claim_intake(
  p_token text,
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
  v_offer public.waitlist_offers;
  v_entry public.waitlist_entries;
  v_form public.intake_forms;
  v_question jsonb;
  v_answer text;
  v_saved jsonb := '[]'::jsonb;
  v_name text := btrim(coalesce(p_signed_name, ''));
  v_waiver text;
begin
  select * into v_offer from public.waitlist_offers where claim_token = p_token;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_entry from public.waitlist_entries where id = v_offer.entry_id;
  if v_entry.status <> 'waiting' then
    raise exception 'waitlist_ended';
  end if;

  select * into v_form from public.intake_forms where stylist_id = v_offer.stylist_id;
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
    v_offer.stylist_id, v_entry.user_id, lower(nullif(v_entry.verified_email, '')),
    public.phone_key(v_entry.verified_phone), v_entry.service_id, v_form.version, v_saved,
    v_form.waiver_text,
    case when v_waiver <> '' then v_name end,
    case when v_waiver <> '' then now() end,
    left(p_ip, 100),
    left(p_user_agent, 300)
  );
end;
$$;

-- ============ WHO CAN CALL WHAT ============
-- Anyone with the claim link (it's the secret).
revoke execute on function public.get_claim_intake(text) from public;
revoke execute on function public.submit_claim_intake(text, jsonb, text, text, text) from public;
grant execute on function public.get_claim_intake(text) to anon, authenticated;
grant execute on function public.submit_claim_intake(text, jsonb, text, text, text) to anon, authenticated;
