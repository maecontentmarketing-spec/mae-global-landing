-- ============================================================
-- MAE Global 招商 Landing Page — Supabase 初始设置
-- 使用方法：Supabase 项目后台 -> SQL Editor -> New query
-- 把这整份文件贴进去，按 Run 执行一次即可。
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) admins：谁可以登入 admin 后台（要最先建，
--    因为下面两张表的规则会用到它）
-- ------------------------------------------------------------
create table if not exists admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text
);

alter table admins enable row level security;

drop policy if exists "admins can view admins table" on admins;
create policy "admins can view admins table"
  on admins for select
  using (exists (select 1 from admins a2 where a2.id = auth.uid()));

-- ------------------------------------------------------------
-- 2) page_content：网站文案（对应 admin 后台每个板块）
-- ------------------------------------------------------------
create table if not exists page_content (
  id text primary key,           -- 板块代号，例如 'hero' / 'kate' / 'system' ...
  content jsonb not null,        -- 该板块的文案内容（JSON）
  updated_at timestamptz not null default now()
);

alter table page_content enable row level security;

-- 任何人都可以读（网站需要公开显示内容）
drop policy if exists "public can read page content" on page_content;
create policy "public can read page content"
  on page_content for select
  using (true);

-- 只有在 admins 表里的登入用户可以新增/修改内容
drop policy if exists "admins can insert page content" on page_content;
create policy "admins can insert page content"
  on page_content for insert
  with check (exists (select 1 from admins where admins.id = auth.uid()));

drop policy if exists "admins can update page content" on page_content;
create policy "admins can update page content"
  on page_content for update
  using (exists (select 1 from admins where admins.id = auth.uid()));

-- ------------------------------------------------------------
-- 3) registrations：报名表单收到的资料
-- ------------------------------------------------------------
create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  city text,
  message text,
  created_at timestamptz not null default now()
);

alter table registrations enable row level security;

-- 任何访客都可以提交报名表（不能读取别人的资料）
drop policy if exists "anyone can submit registration" on registrations;
create policy "anyone can submit registration"
  on registrations for insert
  with check (true);

-- 只有 admin 才能查看名单
drop policy if exists "admins can view registrations" on registrations;
create policy "admins can view registrations"
  on registrations for select
  using (exists (select 1 from admins where admins.id = auth.uid()));

-- ============================================================
-- 设置第一个 admin 帐号（Kate / Amy）的步骤：
--
-- 1. Supabase 后台左侧 Authentication -> Users -> Add user
--    填邮箱 + 密码，建一个登入帐号（这就是以后登入 /admin.html 用的帐号）
-- 2. 建好之后，点开这个 user，复制它的 User UID
-- 3. 回到这里，把下面这行的 UID 和邮箱换成你刚刚建的，执行一次：
--
--    insert into admins (id, email) values
--      ('把 User UID 贴在这里', '把邮箱贴在这里');
--
-- 之后要加第二个 admin（例如 Kate 自己），重复以上步骤再 insert 一行即可。
-- ============================================================
