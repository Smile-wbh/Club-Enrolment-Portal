begin;

create table if not exists public.support_auto_reply_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null unique,
  keywords text[] not null default '{}'::text[],
  response_text text not null,
  priority integer not null default 100,
  requires_human boolean not null default false,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_auto_reply_rules_active_priority
on public.support_auto_reply_rules(is_active, priority, created_at);

drop trigger if exists set_support_auto_reply_rules_updated_at on public.support_auto_reply_rules;
create trigger set_support_auto_reply_rules_updated_at
before update on public.support_auto_reply_rules
for each row execute function public.set_updated_at();

alter table public.support_auto_reply_rules enable row level security;

drop policy if exists "support_auto_reply_rules_select_authenticated" on public.support_auto_reply_rules;
create policy "support_auto_reply_rules_select_authenticated"
on public.support_auto_reply_rules
for select
to authenticated
using (is_active or public.is_admin());

drop policy if exists "support_auto_reply_rules_manage_admin" on public.support_auto_reply_rules;
create policy "support_auto_reply_rules_manage_admin"
on public.support_auto_reply_rules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.support_auto_reply_rules (
  rule_name,
  keywords,
  response_text,
  priority,
  requires_human,
  is_default,
  is_active
)
values
  (
    'human-handoff',
    array['转人工','人工','人工客服','客服','真人','人工服务','human','agent','representative','customer service']::text[],
    'We have received your message. Our customer support team will assist you shortly. If possible, please provide the club or course name, the relevant date and time, and any helpful screenshots or attachments. Thank you for your patience.',
    5,
    true,
    false,
    true
  ),
  (
    'booking-schedule',
    array['booking','book','slot','schedule','reservation','预约','时段','时间段','预定','可预约','名额']::text[],
    'We have received your booking question. Please provide the club or course name, the relevant date and time slot, and we will help you confirm availability, remaining seats, and booking status.',
    20,
    false,
    false,
    true
  ),
  (
    'payment-refund',
    array['pay','payment','fee','refund','order','付款','支付','费用','退款','订单']::text[],
    'We have received your payment question. Please provide the order ID, the club or course name, and the relevant date and time. If a refund is involved, the final outcome will follow the club or course policy.',
    30,
    false,
    false,
    true
  ),
  (
    'maps-location',
    array['map','location','address','venue','地图','位置','地点','地址']::text[],
    'We have received your location question. Please provide the club or course name, along with the map link or location details you entered, and we will help you verify whether the map is displaying correctly.',
    40,
    false,
    false,
    true
  ),
  (
    'registration-publish',
    array['register','registration','publish','approved','review','注册','发布','审核','审批']::text[],
    'We have received your registration or publishing question. Please let us know whether this is about club registration or course publishing, and tell us which step you are stuck on so we can help you continue.',
    50,
    false,
    false,
    true
  ),
  (
    'teaching-course-info',
    array['teaching','class','classes','lesson','lessons','learn','learning','coach','instructor','teacher','teaching content','teaching method','teaching methods','method','methods','content','contents','item','items','syllabus','topic','topics','what learn','教学','上课','课程内容','教练','老师','教学内容','内容','项目','教学方法']::text[],
    'We have received your teaching question. Please tell us the course name if you know it, and we can help you check the course overview, coach, teaching focus, schedule, location, fee, and remaining seats.',
    55,
    false,
    false,
    true
  ),
  (
    'club-course-info',
    array['club','course','info','information','detail','details','俱乐部','课程','信息','详情','介绍']::text[],
    'We have received your information request. Please tell us which club or course you want to know about, and we can help you check the introduction, schedule, location, fee, and available booking slots.',
    60,
    false,
    false,
    true
  ),
  (
    'forum-community',
    array['forum','post','posts','community','comment','comments','thread','threads','论坛','帖子','评论','社区','动态']::text[],
    'We have received your forum question. Please tell us the club, course, or topic you are interested in, and we can help you check recent public posts and discussion topics.',
    65,
    false,
    false,
    true
  ),
  (
    'cancel-reschedule',
    array['cancel','cancellation','reschedule','change booking','change slot','取消','改期','更改时间','换时间']::text[],
    'If you need to cancel or change a booking, please send the club or course name, the date and time, and the reason for the change. We can then help you check the next available step.',
    70,
    false,
    false,
    true
  ),
  (
    'dashboard-records',
    array['dashboard','record','records','history','my booking','bookings','我的预约','记录','历史']::text[],
    'You can review your club bookings, course bookings, and support records in the user dashboard. If anything is missing, please send the related club or course name and the booking date.',
    80,
    false,
    false,
    true
  ),
  (
    'attachments-proof',
    array['attachment','attachments','upload','image','images','screenshot','screenshots','file','附件','上传','截图','图片']::text[],
    'You can include screenshots or other attachments to help us review the issue more quickly. If you are reporting a booking or payment problem, please also include the club or course name and the relevant date and time.',
    90,
    false,
    false,
    true
  ),
  (
    'login-account',
    array['login','log in','sign in','signup','sign up','account','password','登录','注册账号','账户','密码']::text[],
    'If you are having trouble logging in or creating an account, please tell us which step failed and what message you saw on screen. A screenshot is especially helpful for account issues.',
    100,
    false,
    false,
    true
  ),
  (
    'default',
    '{}'::text[],
    'We have received your message. To help us handle it more quickly, please provide the club or course name, the relevant date and time, and any helpful screenshots or attachments. We will assist you as soon as possible.',
    999,
    false,
    true,
    true
  )
on conflict (rule_name) do update set
  keywords = excluded.keywords,
  response_text = excluded.response_text,
  priority = excluded.priority,
  requires_human = excluded.requires_human,
  is_default = excluded.is_default,
  is_active = excluded.is_active,
  updated_at = now();

commit;
