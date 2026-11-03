# Regulars only mode and invite links (step 8)

Three things, all in Safari on your iPad:

- **Regulars only** (Settings): new clients see no times and can't join the
  waitlist. Only confirmed Regulars can book, plus anyone you invite.
- **Freed Regulars times stay Regulars-only**: if a Regulars booking is
  cancelled, that time stays Regulars-only, and only waitlisted Regulars are
  emailed about it.
- **Invite links** (Clients tab): a private, one-time link for one new client,
  so they can book even in Regulars only mode.

## Part 1: Run the SQL (Supabase)

1. Make sure you've already run `0008_waitlist.sql` and `0009_waitlist_retry.sql`.
2. Open `supabase/migrations/0010_regulars_only.sql` on GitHub, tap **Raw**,
   select all and copy.
3. In Supabase go to **SQL Editor → New query**, paste, and tap **Run**.
   You should see "Success. No rows returned".
4. Do the same with `supabase/migrations/0011_match_by_phone.sql` (clients are
   matched by phone number; see "How clients are matched" below).
5. Do the same with `supabase/migrations/0012_invite_wins.sql` (an invite made
   out to the number someone books with always makes them a new, Invited client).
6. Do the same with `supabase/migrations/0013_tagline.sql` (an optional tagline
   for the top of the booking page, set in Settings).

Nothing to add in Vercel. It redeploys by itself.

## How it works

### Regulars only

- Turn it on in **Settings → Regulars → Regulars only**, then tap **Save**.
- New clients opening your booking link see "Online booking is for regulars"
  and a box to confirm their phone number. If the number belongs to a Regular on
  your Clients tab, their times appear. Anyone else is asked to contact you.
- New clients can't join the waitlist either, and waitlisted new clients stop
  getting emails while it's on. Waitlisted Regulars still get them.
- Turn it off the same way. Everything goes back to normal.

### Which bookings count as "Regulars bookings"

A booking counts if it's in a **Regulars only** opening, in a time kept for
Regulars, or made while Regulars only mode is on. If one of these is cancelled
(by you, by the client, or because a deposit wasn't paid), the time is **kept for
Regulars**, even if you later turn Regulars only off.

These kept times show on the **Openings** tab under **Kept for Regulars**. Tap
**Open to everyone** to release one. Switching an opening (or a whole day) to
**Everyone** releases any kept times inside it too. Either way, waitlisted
non-Regulars who want that time are emailed.

### How clients are matched

Clients are matched to your Clients tab by **phone number**:

- Confirmed by **text**: that phone number decides who they are.
- Confirmed by **email**: they count as the client with that email only if
  they book with that client's phone number (or that client has no number on
  file). Booking with a different number makes them a new client, so an invite
  link works for them.
- With an **invite link** made out to the number they book with, they're always
  a new, Invited client on their own card, even if their email is on another
  client's card. (Unless that number belongs to a Regular: then they're that
  Regular and the invite isn't used.)
- A blocked client's number or email blocks the booking either way.

### Invite links

1. On the **Clients** tab, open **Invite a new client**.
2. Type their name. Adding their mobile number is optional, but recommended:
   then only that number can use the link, and you can tap **Text it**.
3. Tap **Make invite link**, then **Text it**, **Share** or **Copy** and send it.

The link lets that person book **one** appointment from your **Everyone** times,
even when Regulars only is on. ("Regulars only" openings stay for Regulars.)
It works for 30 days. Once they've booked, they show on the Clients tab with an
**Invited** badge (tap the **Invited** filter to see them all), and the link
stops working. If they leave the deposit page without paying, the link still
works so they can try again. Tap **Cancel invite** to stop a link you sent.

## Try it

You'll need two phone numbers (or one phone number and one email): one that's a
**Regular** on your Clients tab, and one that isn't on your list.

### 1. Regulars only hides everything from new clients

1. In **Settings → Regulars**, tick **Regulars only** and tap **Save**.
2. Open your booking link in a private Safari tab. You should see "Online booking
   is for regulars", and no services or times.
3. Confirm the number that's **not** a Regular. It should say to contact you, with
   no times and no **Join the waitlist** button.
4. Tap **Not you?** (or open a new private tab), and confirm your **Regular**
   number. Your services and times appear, and **Join the waitlist** works.

### 2. Freed Regulars times stay Regulars-only

1. Keep Regulars only on. As the Regular, book a time.
2. In the dashboard, turn **Regulars only** off, then cancel that booking on the
   **Bookings** tab.
3. On the **Openings** tab, the time appears under **Kept for Regulars**.
4. In a private tab, confirm the non-Regular number: that time isn't there.
   Confirm the Regular number: it's there, marked ★.
5. If a non-Regular is on the waitlist for that time, they get no email. A
   waitlisted Regular does.
6. Tap **Open to everyone** on the Openings tab: now everyone can see and book it,
   and waitlisted non-Regulars who want it are emailed.

### 3. Invite links

1. Turn **Regulars only** on again.
2. On the **Clients** tab, make an invite with the non-Regular's name and number,
   and tap **Copy**.
3. Paste the link into a private Safari tab. You should see "Hi (name)! You're
   invited to book" and your **Everyone** times.
4. Book a time, confirming the same number you put on the invite. (A different
   number gets "This invite is for a different phone number".)
5. On the **Clients** tab, the client shows with an **Invited** badge, and under
   **Invite a new client → Your invites** the invite shows **Used**.
6. Open the link again: "This invite link has already been used".

## How it stays secure

- Who's a Regular is decided by the database, from the phone number (or email)
  the visitor proved with a code. Typing a Regular's number isn't enough.
- In Regulars only mode, the database itself refuses to send times to anyone else
  or to book them, so the page can't be tricked into showing them.
- Each invite link has a long secret code, works once, can only be used by the
  phone number on it (if you added one), and can be cancelled.
