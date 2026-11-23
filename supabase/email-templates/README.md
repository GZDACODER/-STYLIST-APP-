# Supabase email templates

Three emails come from Supabase, not from the app: sign-up confirmation codes,
client sign-in codes and password resets. These files give them the same look
as the app's own emails. Paste each one in once.

In Supabase, go to **Authentication → Emails → Templates**. For each template
below: set the **Subject**, switch the message to **Source** (the `<>` view),
select all of it, paste the whole file in, then tap **Save**.

| Template in Supabase | Subject | File |
|---|---|---|
| Confirm signup | Your Clientele code | `confirm-signup.html` |
| Magic Link | Your sign-in code | `magic-link.html` |
| Reset Password | Choose a new Clientele password | `reset-password.html` |

Leave the `{{ .Token }}`, `{{ .SiteURL }}` and `{{ .TokenHash }}` parts exactly as they are.
Supabase fills them in with the code and the link.
