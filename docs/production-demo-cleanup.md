# Production Demo Cleanup

Use this once when you are ready to remove the development seed data from production.

Main cleanup script:

- [cleanup-production-demo-data.sql](/Users/wbh/Desktop/俱乐部管理系统%20%203/supabase/cleanup-production-demo-data.sql)

What it removes:

- demo clubs inserted by `seed-booking-demo.sql`
- demo courses inserted by `seed-course-demo.sql`
- demo forum posts inserted by `seed-forum-demo.sql`

Important warning:

- The cleanup script deletes rows by known demo slugs and forum titles.
- Do not run it after you have created real production records that reuse the same slugs.

Recommended order:

1. Add your real clubs, real courses, and real forum content first if needed.
2. Review the slug/title lists inside [cleanup-production-demo-data.sql](/Users/wbh/Desktop/俱乐部管理系统%20%203/supabase/cleanup-production-demo-data.sql).
3. Run the script in Supabase `SQL Editor`.
4. Refresh these pages and confirm they now show only real cloud data:
   - `https://club-enrolment-portal.vercel.app/html/msjs.html`
   - `https://club-enrolment-portal.vercel.app/html/specialty.html`
   - `https://club-enrolment-portal.vercel.app/html/mfms.html`
   - `https://club-enrolment-portal.vercel.app/html/spjs.html`
