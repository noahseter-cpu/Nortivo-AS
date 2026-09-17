# Nortivo Support Setup

This project now includes:

- `/support/` for new tickets and ticket lookup
- `/admin/` for the private admin panel
- Netlify Functions for secure server-side access
- Supabase for ticket storage
- Resend for confirmation and reply emails

## 1. Deploy through GitHub

Upload the full project to the GitHub repository connected to Netlify. Do not use Netlify Drop for this version because the support system needs server functions.

Netlify will use `netlify.toml` and publish the `dist` folder automatically.

## 2. Create the database

1. Create a free Supabase project.
2. Open **SQL Editor**.
3. Copy and run everything inside `supabase/schema.sql`.
4. Open **Project Settings → API** and copy:
   - Project URL
   - `service_role` key

Never place the service-role key inside HTML or JavaScript files.

## 3. Configure email

1. Create a Resend account.
2. Verify `nortivo.no` in Resend.
3. Create an API key.

## 4. Add Netlify environment variables

In Netlify, open **Site configuration → Environment variables** and add every variable listed in `.env.example`.

Use a long admin password and a random session secret of at least 32 characters.

## 5. Deploy again

Trigger a new Netlify deploy after saving the environment variables.

Customer support: `https://nortivo.no/support/`

Private admin panel: `https://nortivo.no/admin/`
