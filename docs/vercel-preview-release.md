# Vercel Preview Release Guide

This project is now ready for a Vercel preview deployment.

The current build is a static multi-page site:

- entry page: `/html/index1.html`
- auth and data: `Supabase`
- uploads: `Supabase Storage`
- payment: preview-only simulated success flow

## Before You Deploy

Confirm these are already done:

1. `supabase/schema.sql` has been run in the Supabase SQL Editor.
2. `js/supabase-config.js` contains your real `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. You have tested:
   - sign up and email confirm
   - login and password reset
   - club booking
   - course booking
   - forum post / comment / like
   - message board / support center

## Vercel Setup

Use the Vercel dashboard import flow.

1. Push this project to GitHub, GitLab, or Bitbucket.
2. In Vercel, click `Add New... -> Project`.
3. Import the repository.
4. Keep the project root as the repository root.
5. Framework preset:
   `Other`
6. Build command:
   leave empty
7. Output directory:
   leave empty
8. Deploy

This repo already includes [vercel.json](/Users/wbh/Desktop/俱乐部管理系统%20%203/vercel.json), so:

- `/` opens `/html/index1.html`
- `/login` opens `/html/join.html`
- `/dashboard` opens `/html/join.html?tab=home`
- `/club-dashboard` opens `/html/club_management_dashboard.html`
- `/booking` opens `/html/specialty.html`
- `/courses` opens `/html/mfms.html`
- `/forum` opens `/html/spjs.html`
- `/support` opens `/html/tzgg.html`
- `/settings` opens `/html/settings.html`

## Supabase Auth URLs

After Vercel gives you a preview domain, update Supabase Auth.

In `Authentication -> URL Configuration`:

- `Site URL`
  set this to your production login page later, for example:
  `https://your-domain.com/html/join.html`

- `Redirect URLs`
  add:
  - `http://127.0.0.1:5500/html/join.html`
  - your exact Vercel preview login URL, for example:
    `https://your-project.vercel.app/html/join.html`
  - your final production login URL:
    `https://your-domain.com/html/join.html`

If you want Supabase emails to work across preview deployments, add a wildcard preview pattern that matches your Vercel preview URLs.

## Recommended Preview Test

After the first Vercel deployment:

1. Open the preview URL.
2. Test `/login`.
3. Register a fresh account.
4. Confirm the email opens the Vercel preview `join.html`, not local.
5. Test:
   - forum posting
   - booking creation
   - course booking
   - message board
   - club dashboard updates

For a full post-deploy check, use:

- [online-qa-checklist.md](/Users/wbh/Desktop/俱乐部管理系统%20%203/docs/online-qa-checklist.md#L1)

## What Is Still Preview-Only

These are still intentionally not full production behavior:

- payment success is simulated in the current preview build
- there may still be browser fallback behavior on a few non-core pages

## Recommended Final Production Pass

Before public launch:

1. Replace the simulated payment flow or relabel it as booking confirmation only.
2. Remove any remaining seed/demo records from Supabase.
3. Point Supabase `Site URL` to the final domain.
4. Add custom SMTP in Supabase for production email delivery.
5. Run a fresh two-account test on the Vercel production URL.
