# 2026-04-14 Release Migrations

This checklist is for upgrading an existing production database.

For a fresh environment, use [schema.sql](./schema.sql) instead of running the incremental files one by one.

Do not rerun the full schema on production just to pick up these changes.

## Release Scope

- Club Dashboard map / Google Places support for `clubs` and `courses`
- Structured map data backfill from existing `map_link` values
- Course booking RPC parity for remaining-seat calculations
- Support Center auto-reply rules table and seed data

## Recommended Execution Order

1. Run [check-release-20260414.sql](./check-release-20260414.sql) and save the output.
2. If `public.courses.map_link` is missing, run [add-course-map-link.sql](./add-course-map-link.sql).
   This is only a legacy compatibility step for older databases.
3. Run [add-google-map-place-fields.sql](./add-google-map-place-fields.sql).
4. Run [backfill-google-map-place-fields.sql](./backfill-google-map-place-fields.sql).
5. Run [add-course-booking-counts-rpc.sql](./add-course-booking-counts-rpc.sql).
6. Run [update-course-total-seats.sql](./update-course-total-seats.sql).
7. If you want database-backed support auto replies, run [add-support-auto-reply-rules.sql](./add-support-auto-reply-rules.sql).
8. Run [check-release-20260414.sql](./check-release-20260414.sql) again and compare the results.

## What Each Step Unlocks

- Steps 2-4 are the database prerequisites for the pending Club Dashboard map/place release.
- Step 5 is required by the current course catalog, course detail page, and Support Center when they call `public.get_course_booking_counts`.
- Step 6 updates `public.create_course_booking` so total capacity respects the full course schedule instead of a single slot interpretation.
- Step 7 enables the Support Center to load editable reply rules from the database. The current frontend still has a fallback when this table is missing.

## Notes

- [backfill-google-map-place-fields.sql](./backfill-google-map-place-fields.sql) is intentionally conservative.
  It only fills structured fields when `map_link` contains parseable values.
  A non-zero manual review count after the backfill is not automatically a failure.
- [add-support-auto-reply-rules.sql](./add-support-auto-reply-rules.sql) assumes `public.set_updated_at()` and `public.is_admin()` already exist.
  They are present in [schema.sql](./schema.sql) and should already exist in production for this app.
- [update-course-total-seats.sql](./update-course-total-seats.sql) replaces the booking function only.
  It does not add new table columns.

## Safe Frontend Release Boundary After DB Work

- After steps 2-6, the pending Club Dashboard map/course-form batch is safe to prepare for release.
- Step 7 can be released separately because the support frontend already degrades gracefully when the table is absent.
