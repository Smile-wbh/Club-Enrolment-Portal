# Supabase Release Plan

This project is still a frontend-only demo. The current app stores users, bookings,
forum posts, support messages, and favorites in browser storage, so it is not safe
or durable enough for production.

## Files that still depend on browser storage

- `html/join.html`
  - auth, session, profile, favorites, forum posts, support records
- `html/specialty.html`
  - club bookings and pending payment orders
- `html/mfms.html`
  - course bookings and course favorites
- `html/tzgg.html`
  - support chat history and attachments
- `html/club_management_dashboard.html`
  - club registry, members, courses, and booking management

## Browser key to database mapping

- `club_users`
  - move to `auth.users` + `public.profiles`
- `user_session_v1`
  - replace with Supabase Auth session
- `club_registry_v1`
  - move to `public.clubs` + `public.club_slots`
- `club_members_v1`
  - move to `public.club_members`
- `specialty_bookings_v1`
  - move to `public.club_bookings`
- `specialty_pending_payment_v1`
  - move to `public.club_bookings` with `payment_status = 'pending'`
- `mfms_courses_v1`
  - move to `public.courses`
- `mfms_teaching_bookings_v1`
  - move to `public.course_bookings`
- `mfms_fav_courses_v1`
  - move to `public.course_favorites`
- `spjs_forum_posts_v1`
  - move to `public.forum_posts` + `public.forum_comments`
- `chat_messages_v1`
  - move to `public.support_threads` + `public.support_messages`

## What was added in this repo

- `supabase/schema.sql`
  - the first database schema for auth-adjacent profiles, clubs, slots, bookings,
    courses, forum, support, favorites, timestamps, indexes, and base RLS policies
- `js/supabase-config.example.js`
  - a browser config template for `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `js/supabase-config.js`
  - a safe blank local config so pages do not fail before real keys are added
- `js/supabase-client.js`
  - a tiny shared client factory for this multi-page static app
- `vercel.json`
  - redirects `/` to `/html/index1.html` so the current site can be deployed on Vercel

## Recommended migration order

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. In Supabase Auth:
   - enable email/password auth
   - set the Site URL
   - set redirect URLs for your production and preview domains
   - configure custom SMTP before production mail is enabled
3. Create a local `js/supabase-config.js` from the example file.
4. Add the shared scripts to pages that need data:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../js/supabase-config.js"></script>
<script src="../js/supabase-client.js"></script>
```

5. Replace auth first:
   - migrate `doLogin`
   - migrate `doSignup`
   - migrate password reset flow
6. Replace booking flows next:
   - `html/specialty.html`
   - `html/mfms.html`
7. Replace forum, support, and favorites after auth and bookings are stable.
8. Move images and uploads to Supabase Storage:
   - `avatars`
   - `club-media`
   - `forum-media`
   - `support-files`
9. Deploy the frontend to Vercel.

## Production notes

- The browser may use the Supabase anon key. That key is expected to be public.
- Never expose the Supabase service role key in browser code.
- Do not let normal users self-register as `admin`. That role should be assigned manually in SQL.
- Booking capacity checks should not rely only on client-side logic.
- For real booking locks, payment callbacks, or admin actions, add a database
  function or an Edge Function.
- Support attachments should be stored as file URLs in Storage, not as base64
  payloads in database rows.

## Best next coding step

The highest-value next change is to replace the auth flow in `html/join.html`
with Supabase Auth. Once auth is server-backed, the rest of the app can move to
real user IDs and RLS policies without inventing a second identity system.
