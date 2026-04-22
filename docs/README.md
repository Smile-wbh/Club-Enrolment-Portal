# Club Enrollment Portal

A multi-page static web application for browsing clubs, booking activities, exploring courses, joining forum discussions, and managing club operations.

## 1. Project Overview

This project is organized around user-facing club services plus one management back-office page:

- `Home`: landing page and platform introduction
- `Club Preview`: browse all clubs and open detail pages
- `Club Booking`: book club sessions and pay for slots
- `Club Courses`: browse and book teaching courses
- `Club Forum`: post, follow, like, and comment
- `Support Center`: support messages and help content
- `Join / User Center`: login, signup, profile, bookings, favorites, forum records
- `Club Management Dashboard`: club owner operations

## 2. Main Pages

- `html/home.html`: home page
- `html/join.html`: login, signup, and user center
- `html/Club-Preview.html`: club preview page
- `html/club_detail.html`: shared club detail template page
- `html/Club-Booking.html`: club booking page
- `html/Club-Booking-payment.html`: booking payment page
- `html/Club-Courses.html`: course list page
- `html/Club-Courses-detail.html`: course detail page
- `html/Club-Forum.html`: forum page
- `html/messages.html`: messages page
- `html/Support-Center.html`: support center page
- `html/club_management_dashboard.html`: club owner dashboard

Club-specific detail pages are stored in `html/club/`.

## 3. Folder Structure

```text
api/        Serverless helper APIs
css/        Page stylesheets
docs/       Release, QA, and project notes
html/       All front-end pages
js/         Shared logic, Supabase services, widgets
supabase/   SQL schema, seed data, cleanup scripts
zp/         Image assets used by clubs and page banners
```

## 4. Core Runtime Files

### Frontend pages

- `html/home.html`
- `html/join.html`
- `html/Club-Preview.html`
- `html/Club-Booking.html`
- `html/Club-Courses.html`
- `html/Club-Forum.html`
- `html/Support-Center.html`

### Shared scripts

- `js/supabase-config.js`: Supabase project config
- `js/supabase-client.js`: shared browser client factory
- `js/supabase-bookings.js`: booking data service
- `js/supabase-courses.js`: course data service
- `js/supabase-forum.js`: forum data service
- `js/supabase-support.js`: support data service
- `js/supabase-storage.js`: upload/storage helpers
- `js/supabase-club-admin.js`: club manager dashboard service
- `js/supabase-local-migration.js`: local-to-cloud fallback and migration helpers
- `js/portal-header-auth.js`: shared top-bar login/logout state
- `js/portal-detail-header.js`: shared detail-page header and back button
- `js/custom-dialogs.js`: custom in-page dialogs replacing browser alerts
- `js/messages.js`: message page logic
- `js/Club-Booking-payment.js`: booking payment flow

### Shared styles

- `css/home.css`
- `css/join.css`
- `css/Club-Preview.css`
- `css/Club-Booking.css`
- `css/Club-Courses.css`
- `css/Club-Forum.css`
- `css/Support-Center.css`
- `css/messages.css`
- `css/club_management_dashboard.css`
- `css/yl.css`

## 5. Data And Deployment

- `supabase/schema.sql`: current database schema for fresh environments
- `supabase/demo/`: optional demo seed and cleanup SQL
- `supabase/archive/`: one-off migration and release upgrade SQL kept for reference
- `api/resolve-map.js`: resolves short map links for accurate venue maps
- `vercel.json`: redirects root paths like `/`, `/login`, `/clubs`, `/booking`

## 6. Assets

The `zp/` folder stores club covers, banners, and logo assets.

Examples:

- `zp/gywm.webp`: platform logo / shared brand image
- `zp/lq.webp`: basketball
- `zp/ymq.webp`: badminton
- `zp/bq.webp`: baseball
- `zp/ppq.webp`: table tennis
- `zp/pq.webp`: volleyball
- `zp/pkq.webp`: pickleball

## 7. Current Cleanup Notes

Recent cleanup completed:

- removed unused legacy `css/cart.css`
- removed outdated `abc.md` that still referenced `cart.html`
- removed unreferenced assets `zp/dj.webp` and `zp/jxkc.webp`
- kept deployment / database docs that still provide operational context

## 8. Suggested Reading Order

If someone wants to understand the project quickly, read files in this order:

1. `docs/README.md`
2. `html/home.html`
3. `html/join.html`
4. `html/Club-Preview.html`
5. `html/Club-Booking.html`
6. `html/Club-Courses.html`
7. `html/Club-Forum.html`
8. `js/supabase-client.js`
9. `js/supabase-bookings.js`
10. `js/supabase-courses.js`
11. `js/supabase-forum.js`
12. `docs/project-file-guide.md`
