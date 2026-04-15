# Project File Guide

This document is a maintenance-oriented map of the repository. It explains what each major file group does, which files are most important, and which items look like legacy leftovers.

## 1. Page Grouping

### Portal entry and user-facing pages

- `html/home.html`: portal home page
- `html/join.html`: login, signup, profile center, bookings, favorites, forum records
- `html/Club-Preview.html`: club preview list
- `html/club_detail.html`: shared club detail template logic
- `html/Club-Booking.html`: club booking
- `html/Club-Booking-payment.html`: payment simulation / confirmation
- `html/Club-Courses.html`: course list
- `html/Club-Courses-detail.html`: course detail
- `html/Club-Forum.html`: forum page
- `html/messages.html`: messages and direct communication
- `html/Support-Center.html`: support center

### Management pages

- `html/club_management_dashboard.html`: club manager operations

### Club detail pages

These are separate detail entries under `html/club/`:

- `football.html`
- `badminton.html`
- `basketball.html`
- `baseball.html`
- `pingpong.html`
- `pickleball.html`
- `volleyball.html`
- `tennis.html`
- `swimming.html`
- `cycling.html`
- `running.html`
- `programming.html`
- `music.html`
- `golf.html`
- `rugby.html`
- `handball.html`
- `gymnastics.html`

## 2. Script Grouping

### Infrastructure

- `js/vue.js`: Vue runtime
- `js/supabase-config.js`: Supabase URL and anon key
- `js/supabase-client.js`: shared Supabase client creation

### Business services

- `js/supabase-bookings.js`: club booking database access
- `js/supabase-courses.js`: course booking database access
- `js/supabase-forum.js`: forum records
- `js/supabase-support.js`: support / help records
- `js/supabase-storage.js`: uploads and storage
- `js/supabase-club-admin.js`: club manager operations
- `js/supabase-local-migration.js`: local fallback and migration logic

### Shared UI helpers

- `js/portal-header-auth.js`: top-bar auth actions
- `js/portal-detail-header.js`: shared detail-page header rendering
- `js/custom-dialogs.js`: custom modal dialogs
- `js/chat-widget.js`: floating chat widget

### Page-specific logic

- `js/messages.js`: messages page behavior
- `js/Club-Booking-payment.js`: payment page behavior

## 3. Style Grouping

### Page styles

- `css/home.css`
- `css/join.css`
- `css/Club-Preview.css`
- `css/Club-Booking.css`
- `css/Club-Booking-payment.css`
- `css/Club-Courses.css`
- `css/Club-Forum.css`
- `css/Support-Center.css`
- `css/messages.css`
- `css/club_management_dashboard.css`
- `css/yl.css`

### Shared styles

- `css/chat-widget.css`
- `css/portal-header-auth.css`

## 4. Image Asset Grouping

### Shared assets

- `zp/gywm.webp`: logo / brand image

### Club covers

- `zp/zq.webp`: football
- `zp/ymq.webp`: badminton
- `zp/yy1.webp`: swimming
- `zp/qx.webp`: cycling
- `zp/bc.webp`: programming
- `zp/wq.webp`: tennis
- `zp/yy.webp`: music
- `zp/pb.webp`: running
- `zp/lq.webp`: basketball
- `zp/grf.webp`: golf
- `zp/glq.webp`: rugby
- `zp/sj.webp`: handball
- `zp/tc.webp`: gymnastics
- `zp/ppq.webp`: table tennis
- `zp/bq.webp`: baseball
- `zp/pq.webp`: volleyball
- `zp/pkq.webp`: pickleball

### Older or fallback assets

- `zp/hb1.webp`
- `zp/hb2.webp`
- `zp/hb3.webp`

## 5. Most Important Files For A Demo Or Defense

If you only want to remember the essential files, focus on these:

- `html/home.html`
- `html/join.html`
- `html/Club-Preview.html`
- `html/Club-Booking.html`
- `html/Club-Courses.html`
- `html/Club-Forum.html`
- `html/Support-Center.html`
- `html/club_management_dashboard.html`
- `js/supabase-client.js`
- `js/supabase-bookings.js`
- `js/supabase-courses.js`
- `js/supabase-forum.js`
- `js/supabase-support.js`
- `supabase/schema.sql`
- `supabase/demo/`: optional seed and cleanup SQL
- `supabase/archive/`: one-off migration and release SQL
- `vercel.json`

## 6. Suggested Rename / Reorganization Plan

I did not rename files automatically, but this would be a cleaner future structure:

### Keep current pages but group mentally like this

- `home`: `home.html`
- `auth-and-user`: `join.html`, `messages.html`
- `clubs`: `Club-Preview.html`, `club_detail.html`, `html/club/*`
- `booking`: `Club-Booking.html`, `Club-Booking-payment.html`
- `courses`: `Club-Courses.html`, `Club-Courses-detail.html`
- `community`: `Club-Forum.html`
- `support`: `Support-Center.html`
- `management`: `club_management_dashboard.html`

### Cleanup already completed

- removed legacy `css/cart.css`
- removed outdated `abc.md`
- removed unreferenced assets `zp/dj.webp` and `zp/jxkc.webp`

## 7. Practical Maintenance Advice

- When changing club covers, check both `html/` page data and `js/supabase-*` fallback mappings.
- When changing sign-up/login navigation, check static page headers and shared header scripts.
- When changing club details, check both `html/club_detail.html` and `html/club/*.html`.
- When changing booking behavior, check `html/Club-Booking.html`, `html/Club-Booking-payment.html`, and `js/supabase-bookings.js`.
- When changing course behavior, check `html/Club-Courses.html`, `html/Club-Courses-detail.html`, and `js/supabase-courses.js`.
