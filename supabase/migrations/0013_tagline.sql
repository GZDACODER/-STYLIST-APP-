-- Step 9: an optional tagline on the stylist's booking page.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0010_regulars_only.sql first. Running this again later is safe.

-- A short line shown under "Book with" on the booking page, like
-- "Colour and precision cutting in Logan Square". Empty = none.
alter table public.stylists add column if not exists tagline text not null default '';

alter table public.stylists drop constraint if exists stylists_tagline_length;
alter table public.stylists add constraint stylists_tagline_length
  check (char_length(tagline) <= 120);

-- Stylists can change their own tagline in Settings.
grant update (tagline) on public.stylists to authenticated;

-- Public: the stylist's page. Same as step 8, plus the tagline.
create or replace function public.get_booking_page(p_slug text, p_invite text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stylist public.stylists;
  v_invite public.client_invites;
begin
  select * into v_stylist from public.stylists where slug = lower(p_slug);
  if not found then
    return null;
  end if;

  perform public.apply_auto_regulars(v_stylist.id);

  if p_invite is not null then
    select * into v_invite from public.client_invites
    where stylist_id = v_stylist.id and token = p_invite;
  end if;

  return jsonb_build_object(
    'business_name', v_stylist.business_name,
    'tagline', v_stylist.tagline,
    'slug', v_stylist.slug,
    'timezone', v_stylist.timezone,
    'cancellation_policy', v_stylist.cancellation_policy,
    'waitlist_enabled', v_stylist.waitlist_enabled,
    'regulars_only', v_stylist.regulars_only,
    -- What they can do: 'regular', 'invited', 'new', 'unknown', 'anonymous' or 'blocked'.
    'access', public.booking_access(v_stylist.id, p_invite),
    -- The invite link they came with: 'open', 'used', 'expired', 'cancelled',
    -- 'busy' (someone is paying a deposit with it) or 'invalid'.
    'invite', case
      when p_invite is null then null
      when v_invite.id is null then jsonb_build_object('state', 'invalid')
      when (public.booking_find_invite(v_stylist.id, p_invite)).id is not null
        then jsonb_build_object('state', 'open', 'name', v_invite.name)
      when public.invite_state(v_invite) = 'open'
        then jsonb_build_object('state', 'busy', 'name', v_invite.name)
      else jsonb_build_object('state', public.invite_state(v_invite), 'name', v_invite.name)
    end,
    'viewer_status', public.booking_viewer_status(v_stylist.id),
    'viewer_email', public.booking_verified_email(),
    'viewer_phone', public.booking_verified_phone(),
    'services', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sv.id,
            'name', sv.name,
            'price_cents', sv.price_cents,
            'duration_minutes', sv.duration_minutes,
            'deposit_cents', public.service_deposit_cents(v_stylist, sv)
          )
          order by sv.created_at
        )
        from public.services sv
        where sv.stylist_id = v_stylist.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.get_booking_page(text, text) from public;
grant execute on function public.get_booking_page(text, text) to anon, authenticated;
