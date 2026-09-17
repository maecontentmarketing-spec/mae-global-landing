// ============================================================
// 「我的专属名单」独立查询页
// 给不在 EL002 系统里、但也有专属连接的人用（比如 admin 在后台
// 「专属连接工具」临时生成的连接）。
//
// 网址格式：my-list.html?code=xxx&key=xxx
// 靠 code + key 两个都对了，Supabase 的 get_my_registrations() 函数
// 才会回传资料，而且只回传这个代码自己带来的名单，不需要登入任何帐号，
// 也看不到别人的资料。
// ============================================================

function getParam(name) {
  return (new URLSearchParams(window.location.search).get(name) || "").trim();
}

// 把电话号码整理成 WhatsApp 连结用得到的格式（去掉符号/空格，0 开头的换成 60 开头）。
// 只是方便点一下就能开 WhatsApp，格式抓不准的话手动加对方也可以。
function toWaLink(phone) {
  if (!phone) return null;
  let digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = "60" + digits.slice(1);
  return `https://wa.me/${digits}`;
}

async function loadMyList() {
  const statusEl = document.getElementById("my-list-status");
  const tableEl = document.getElementById("my-list-table");
  const bodyEl = document.getElementById("my-list-body");

  const code = getParam("code");
  const key = getParam("key");

  if (!code || !key) {
    statusEl.textContent = "连接不完整，请使用完整的专属查询连接（跟当初给你的一样，不要自己删改网址）。";
    return;
  }

  const { data, error } = await supabaseClient.rpc("get_my_registrations", {
    p_code: code,
    p_token: key
  });

  if (error) {
    statusEl.textContent = "读取失败，请稍后再试一次，或联络 Amy 确认这条连接是否正确。";
    return;
  }

  if (!data || !data.length) {
    statusEl.textContent = "目前还没有资料——可能是连接有误，或者还没有人透过你的连接报名，隔一段时间再回来看看。";
    return;
  }

  statusEl.hidden = true;
  tableEl.hidden = false;
  bodyEl.innerHTML = data.map(r => {
    const wa = toWaLink(r.phone);
    const phoneCell = wa
      ? `<a href="${wa}" target="_blank" rel="noopener">${r.phone}</a>`
      : (r.phone || "-");
    return `
    <tr>
      <td>${r.name || ""}</td>
      <td>${phoneCell}</td>
      <td>${r.city || "-"}</td>
      <td>${new Date(r.created_at).toLocaleString("zh-CN")}</td>
    </tr>`;
  }).join("");
}

loadMyList();
