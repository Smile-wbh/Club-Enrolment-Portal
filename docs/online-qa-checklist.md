# Online QA Checklist

Use this checklist after each Vercel deployment.

Current production domain:

- `https://club-enrolment-portal.vercel.app`

Recommended test setup:

- account A: normal user
- account B: second normal user
- account C: club manager account

## 1. Auth

Pages:

- `https://club-enrolment-portal.vercel.app/html/join.html`
- `https://club-enrolment-portal.vercel.app/login`

Checks:

1. Register a brand-new account.
2. Confirm the email opens the Vercel `join.html` page.
3. Log in successfully.
4. Log out successfully.
5. Use forgot password and confirm the reset flow returns to `join.html`.
6. Open `settings.html` and change password once.

Pass result:

- no redirect loops
- no local file path
- no directory listing page
- no Supabase config error

## 2. Club Booking

Page:

- `https://club-enrolment-portal.vercel.app/html/specialty.html`

Checks:

1. Log in with account A.
2. Open any club.
3. Pick an available slot.
4. Complete the current preview payment flow.
5. Open user dashboard and confirm the booking appears.
6. Open Supabase table `club_bookings` and confirm a new row exists.
7. Cancel one booking once and confirm the status updates.

Pass result:

- slot selection works
- booking is visible after refresh
- booking persists across browsers/devices

## 3. Courses

Pages:

- `https://club-enrolment-portal.vercel.app/html/mfms.html`
- `https://club-enrolment-portal.vercel.app/html/mfms-detail.html`

Checks:

1. Open course list.
2. Open any course detail page.
3. Book one course.
4. Save one course to favorites.
5. Open user dashboard and confirm:
   - `Course Bookings`
   - `My Favorites`
6. Remove one favorite and confirm it disappears after refresh.

Pass result:

- booking and favorite actions persist
- cloud data reloads correctly

## 4. Forum

Page:

- `https://club-enrolment-portal.vercel.app/html/spjs.html`

Checks:

1. With account A, create one post.
2. Add one image post.
3. Add one video post.
4. With account B, like account A's post.
5. With account B, comment on account A's post.
6. With account A, reply to that comment.
7. Open account A forum profile and confirm cover/avatar load without manual refresh.

Pass result:

- posts reload from cloud
- likes increase immediately or after expected refresh
- comments and replies persist
- media stays inside card layout

## 5. Message Board And Support

Pages:

- `https://club-enrolment-portal.vercel.app/html/tzgg.html`
- `https://club-enrolment-portal.vercel.app/html/join.html?tab=message_board`

Checks:

1. With account B, open account A forum profile.
2. Click `Send Message`.
3. Send one message.
4. Confirm account B sees a `Sent` record.
5. Confirm account A sees a `Received` record.
6. In support center, send one support message.
7. Confirm it appears in `My Support`.

Pass result:

- sent and received message board records both appear
- support message persists after refresh

## 6. Club Manager Dashboard

Page:

- `https://club-enrolment-portal.vercel.app/html/club_management_dashboard.html`

Checks:

1. Log in with account C.
2. Register one new club.
3. Edit that club once.
4. Add one member.
5. Publish one course.
6. Edit that course once.
7. Open `Activity Management` and change one booking status.
8. Refresh the page and confirm everything remains.

Pass result:

- dashboard loads from Supabase
- edits survive refresh
- the same data is visible on a second browser

## 7. Storage

Checks:

1. Upload a profile avatar.
2. Upload a forum cover image.
3. Upload a forum post image.
4. Upload a forum comment image.
5. Upload a forum video.
6. Confirm all media loads from Supabase Storage after refresh.

Pass result:

- media URLs are not local blob-only URLs after save
- media still loads after logout/login

## 8. Production Notes

Current intentional limitation:

- payment is still a preview-only simulated success flow

Recommended before public launch:

1. Remove or archive seed/demo records.
2. Add custom SMTP in Supabase.
3. Replace simulated payment or relabel it as booking confirmation.
4. Run this checklist once more on mobile.
