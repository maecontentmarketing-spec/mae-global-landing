// ============================================================
// Supabase 连接设置
// ------------------------------------------------------------
// 1. 到 https://supabase.com 建好 project 之后，
//    在 Project Settings -> API 页面可以找到：
//    - Project URL
//    - anon public key
// 2. 把下面两个值换成你自己的，存档、上传 GitHub 都不需要隐藏
//    （anon key 本来就是设计给前端公开使用的，
//    真正的安全靠 Supabase 的 Row Level Security 规则，
//    已经写在 supabase/schema.sql 里）
// ============================================================
const SUPABASE_URL = "https://ltdoqcycrrriztcacbyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0ZG9xY3ljcnJyaXp0Y2FjYnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NzA2MDMsImV4cCI6MjEwNDM0NjYwM30.E5jL7ma75ICBGvAEDlrfzPMMLcOB4XQ8FKAfmUX2uSA";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
