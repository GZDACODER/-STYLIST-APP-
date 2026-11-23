# Legal review needed before launch

These are **templates**, written in plain English for Clientele. They are not
legal advice and must be reviewed by a lawyer before launch:

- Terms of Service: `app/(home)/terms/page.js`
- Privacy Policy: `app/(home)/privacy/page.js`
- The Clientele agreement pros sign (summary, checkboxes, version): `lib/agreements.js`
- The starter client waivers for each business type (Part 2, layer 2):
  `lib/templates/*.js` (`presets.intake.waiver`)

Things to ask the lawyer about specifically:
- Electronic signature validity (E-SIGN Act / UETA) and what we store as
  evidence: typed name, drawn signature, time, IP address, device, exact text
  and version (`pro_agreements`, and client waiver records).
- Tattoo consent and age rules vary by state (some allow 16-17 with notarised
  parental consent; some require 18 even with consent).
- Minors and guardian signatures (tutoring, any service for under-18s).
- Refund, cancellation and deposit-forfeit wording.
- Data retention for signed records and deleted accounts.

When any of these texts change, bump its version so people sign again.
