# Booking setup (step 4)

Do these once in Supabase, in Safari.

## 1. Run the SQL

Open `supabase/migrations/0004_booking.sql`, copy all of it, paste into
**SQL Editor → New query**, and tap **Run**.

## 2. Make the emails contain a code

Clients confirm their email by typing a code. Supabase's emails send a link by
default, so add the code to two email templates.

Go to **Authentication → Emails → Templates**.

**"Confirm sign up"** template (new clients and new stylists get this one).
Replace the message body with:

```html
<h2>Your code: {{ .Token }}</h2>
<p>Booking an appointment? Type this code on the booking page.</p>
<p>Signing up as a stylist? <a href="{{ .ConfirmationURL }}">Tap here to confirm your account</a>.</p>
```

**"Magic link"** template (returning clients get this one):

```html
<h2>Your code: {{ .Token }}</h2>
<p>Type this code on the booking page. If you didn't ask for it, you can ignore this email.</p>
```

Tap **Save** on each.

## 3. Check two settings

- **Authentication → Sign In / Providers → Email**: **Confirm email** must be **ON**.
  (This is part of what stops people from pretending to be your regulars.)
- **Authentication → Sign In / Providers**: **Allow new users to sign up** must be **ON**,
  because a client's first code creates a login for them.

## 4. Email sending (needed before real clients use it)

Supabase's built-in email only sends to **your own Supabase team's email addresses**,
and only a few per hour. That's enough to test with your own email, but real clients
won't get their codes until you connect an email service:

1. Sign up at **resend.com** (free plan is fine).
2. In Resend, **add your domain** (for example `yoursalonapp.com`) and add the DNS
   records it shows you where you bought the domain. You need to own a domain.
3. In Resend, create an **API key**.
4. In Supabase, go to **Authentication → Emails → SMTP Settings**, turn on
   **Enable custom SMTP**, and fill in:
   - Sender email: `bookings@yourdomain.com`
   - Sender name: your app's name
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
5. Save. Then in **Authentication → Rate Limits**, check how many emails per hour are
   allowed and raise it if you need to.

## How it stays secure

- The booking page can't read the openings table at all. It can only ask the
  database three questions: "show this stylist's page", "which times can I see?",
  and "book this time".
- The database decides who's a regular by checking the email the visitor
  **proved** with a code. Typing an email isn't enough, and neither is a
  password login with someone else's email.
- "Regulars only" times are never sent to anyone else's phone, not even hidden.
- Blocked clients see no times and can't book. A blocked client's phone number
  also stops a booking.
- Two people can't book the same time. The database refuses the second one.
