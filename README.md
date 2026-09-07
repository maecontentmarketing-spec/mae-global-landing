# MAE Global 招商 Landing Page

纯静态网站（HTML + CSS + JS），数据存在 Supabase，部署在 Netlify，代码托管在 GitHub。
没有 build 步骤、没有 Node.js 依赖——改完文件，git push 上去，Netlify 会自动重新部署。

## 文件结构

```
index.html          公开的招商 landing page
admin.html          内容编辑后台（登入后可改文案 + 看报名名单）
css/style.css       全站样式
js/content.js       预设文案（Supabase 没有存档时显示这里的内容）
js/supabase-config.js   Supabase 连接设置（URL + anon key）
js/site.js          前台页面逻辑（读取内容、处理报名表单）
js/admin.js         后台编辑逻辑（登入、逐板块保存、报名名单）
supabase/schema.sql 数据库结构 + 权限设置，一次性在 Supabase 执行
netlify.toml        Netlify 部署设置
```

## 一、设置 Supabase（存数据）

1. 到 https://supabase.com 用你的账号新建一个 project（免费额度够用）。
2. 左侧 **SQL Editor** -> New query，把 `supabase/schema.sql` 整份内容贴进去，按 **Run**。
   这会建好三张表：
   - `page_content`：网站文案（admin 后台改的内容存这里）
   - `registrations`：报名表单收到的资料
   - `admins`：谁可以登入 admin 后台
3. 左侧 **Authentication -> Users -> Add user**，用你自己的邮箱设一个密码，
   这就是以后登入 `/admin.html` 的帐号。
4. 建好后点开这个用户，复制它的 **User UID**，回到 SQL Editor 执行：
   ```sql
   insert into admins (id, email) values ('刚才复制的 UID', '你的邮箱');
   ```
   （Kate 如果也要能登入后台，重复第 3-4 步再加一行就好。）
5. 左侧 **Project Settings -> API**，复制：
   - Project URL
   - anon public key
   贴到 `js/supabase-config.js` 里对应的位置。

## 二、放上 GitHub（记录所有改动）

```bash
cd mae-landing-site
git init
git add .
git commit -m "Initial commit: MAE Global landing page"
git branch -M main
git remote add origin https://github.com/<你的帐号>/<repo 名字>.git
git push -u origin main
```

之后每次改文字/样式，重复 `git add . && git commit -m "说明这次改了什么" && git push` 即可，
GitHub 的 commit 记录就是完整的改动历史，不需要另外整理 SOP 文档。

## 三、部署到 Netlify（把网页放上网）

1. Netlify 后台 -> **Add new site -> Import an existing project**
2. 选 GitHub，授权后选刚才建的 repo
3. Build 设置全部留空/默认（这是纯静态网站，不需要 build command，publish directory 填 `.` 或留空）
4. 按 Deploy，几十秒后就会拿到一个 `xxx.netlify.app` 网址
5. 之后每次 `git push`，Netlify 会自动重新部署，不需要手动操作

## 之后要修改内容

- **文字内容**（标题、文案、FAQ 等）：直接上 `/admin.html` 登入后台改，保存后网站立即更新，
  不需要动代码、不需要重新部署。
- **样式/排版**（颜色、间距、要加新板块）：改 `index.html` / `css/style.css`，
  git push 上去，Netlify 会自动更新。
- **图片**：目前先用占位框标示位置。图片可以先上传到 Supabase Storage 或 Cloudinary，
  拿到网址后把 `index.html` 里对应的 `<div class="media-slot">...` 换成 `<img src="图片网址">`。
