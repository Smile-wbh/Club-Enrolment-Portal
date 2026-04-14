# Club Enrollment Portal

A multi-page static web application for browsing clubs, booking activities, exploring courses, joining forum discussions, and managing club operations.

## 1. Project Overview

This project is organized around user-facing club services plus two management back-office pages:

- `Home`: landing page and platform introduction
- `Club Preview`: browse all clubs and open detail pages
- `Club Booking`: book club sessions and pay for slots
- `Club Courses`: browse and book teaching courses
- `Club Forum`: post, follow, like, and comment
- `Support Center`: support messages and help content
- `Join / User Center`: login, signup, profile, bookings, favorites, forum records
- `Club Management Dashboard`: club owner operations
- `Admin Dashboard`: platform supervision page

## 2. Main Pages

- `html/index1.html`: home page
- `html/join.html`: login, signup, and user center
- `html/msjs.html`: club preview page
- `html/club_detail.html`: shared club detail template page
- `html/specialty.html`: club booking page
- `html/specialty-payment.html`: booking payment page
- `html/mfms.html`: course list page
- `html/mfms-detail.html`: course detail page
- `html/spjs.html`: forum page
- `html/messages.html`: messages page
- `html/tzgg.html`: support center page
- `html/club_management_dashboard.html`: club owner dashboard
- `html/admin.html`: admin dashboard

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

- `html/index1.html`
- `html/join.html`
- `html/msjs.html`
- `html/specialty.html`
- `html/mfms.html`
- `html/spjs.html`
- `html/tzgg.html`

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
- `js/specialty-payment.js`: booking payment flow

### Shared styles

- `css/index1.css`
- `css/join.css`
- `css/msjs.css`
- `css/specialty.css`
- `css/mfms.css`
- `css/spjs.css`
- `css/tzgg.css`
- `css/messages.css`
- `css/club_management_dashboard.css`
- `css/yl.css`

## 5. Data And Deployment

- `supabase/schema.sql`: current database schema
- `supabase/seed-*.sql`: demo seed data
- `supabase/cleanup-*.sql`: cleanup scripts
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

## 7. Current Legacy / Cleanup Notes

These files are worth reviewing later:

- `css/cart.css`: no matching `cart.html` exists in the current repo
- `abc.md`: still references `cart.html`, so parts of it reflect an older file structure
- `zp/dj.webp`: not currently referenced by the codebase

## 8. Suggested Reading Order

If someone wants to understand the project quickly, read files in this order:

1. `README.md`
2. `html/index1.html`
3. `html/join.html`
4. `html/msjs.html`
5. `html/specialty.html`
6. `html/mfms.html`
7. `html/spjs.html`
8. `js/supabase-client.js`
9. `js/supabase-bookings.js`
10. `js/supabase-courses.js`
11. `js/supabase-forum.js`
12. `docs/project-file-guide.md`

