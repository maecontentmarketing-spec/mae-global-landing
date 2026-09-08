// ============================================================
// Admin 后台逻辑：登入（Supabase Auth）+ 逐板块编辑 + 报名名单
// ============================================================

const TEXT_FIELDS = {
  hero: [["title", "标题", "text"], ["lede", "副标题", "textarea"], ["intro", "正文", "textarea"], ["button", "按钮文字", "text"]],
  kate: [["quote", "引言", "text"], ["p1", "段落 1", "textarea"], ["p2", "段落 2", "textarea"], ["p3", "段落 3", "textarea"], ["signature", "署名", "text"], ["p4", "段落 4", "textarea"], ["p5", "段落 5", "textarea"], ["p6", "段落 6", "textarea"]],
  opportunity: [["p1", "段落 1", "textarea"], ["p2", "段落 2（保留「aMAEzing AI GROW System」字样）", "textarea"], ["p3", "段落 3", "textarea"]],
  system: [["title", "标题", "text"], ["subtitle", "副标题", "textarea"], ["footnote", "结尾文字", "textarea"]],
  brand: [["stat1_value", "数值 1", "text"], ["stat1_label", "说明 1", "text"], ["stat2_value", "数值 2", "text"], ["stat2_label", "说明 2", "text"], ["stat3_value", "数值 3", "text"], ["stat3_label", "说明 3", "text"], ["p1", "段落 1", "textarea"], ["p2", "段落 2", "textarea"], ["p3", "段落 3", "textarea"]],
  milestones: [["title", "标题", "text"], ["subtitle", "副标题", "textarea"]],
  event: [["title", "标题", "text"], ["subtitle", "提示语", "textarea"], ["date", "日期", "text"], ["time", "时间", "text"], ["place", "地点", "text"], ["timezone", "时区", "text"]],
  results: [["title", "标题", "text"], ["warning", "警示文字", "textarea"]],
  register: [["p1", "段落 1", "textarea"], ["p2", "段落 2", "textarea"], ["button", "按钮文字", "text"]],
  closing: [["line1", "第一行", "text"], ["line2", "第二行", "text"]],
  footer: [["desc", "品牌简介", "textarea"], ["email", "联系邮箱", "text"], ["phone", "联系电话", "text"], ["address", "地址", "text"]]
};

let lastLeadsRows = []; // 上次读到的报名名单（给 Email 按钮 / CSV 导出用）

const SECTION_LABELS = {
  hero: "① Hero 首屏", kate: "② Kate 创办人", opportunity: "③ 重新框定机会",
  system: "④ aMAEzing AI GROW System", highlights: "⑤ 四大亮点", brand: "⑥ MAE 品牌背书",
  milestones: "MAE Milestone 画廊", event: "⑦ 时间地点", results: "⑧ 真实成果",
  faq: "⑨ 谁适合参与 + FAQ", register: "⑩ 报名区块文案", closing: "⑪ 结尾", footer: "页脚"
};

let currentContent = null; // 合并 Supabase 覆盖后的完整内容（跟 site.js 逻辑一致）

function textInput(id, label, type, value) {
  const safe = (value || "").toString();
  return `<div class="admin-field"><label>${label}</label>${
    type === "textarea"
      ? `<textarea data-field="${id}">${safe}</textarea>`
      : `<input type="text" data-field="${id}" value="${safe.replace(/"/g, "&quot;")}">`
  }</div>`;
}

// 图片上传栏位：预览框 + 选档案按钮 + 一个藏起来的 input 存网址
// （藏起来的 input 用跟文字栏位一样的 data-field，保存的时候会一起被读到）
function imageField(fieldPath, label, url) {
  const safeUrl = (url || "").toString();
  const previewHtml = safeUrl ? `<img src="${safeUrl}" alt="">` : `<span>尚未上传</span>`;
  return `
    <div class="admin-field img-field">
      <label>${label}</label>
      <div class="img-upload-row">
        <div class="img-preview">${previewHtml}</div>
        <div class="img-upload-controls">
          <input type="file" accept="image/*" class="img-file-input">
          <div class="img-upload-status"></div>
        </div>
      </div>
      <input type="hidden" data-field="${fieldPath}" value="${safeUrl.replace(/"/g, "&quot;")}">
    </div>`;
}

// 勾选栏位（例如「是否显示报名人数」），data-bool="1" 让 saveSection 知道要读 .checked 而不是 .value
function checkboxField(fieldPath, label, checked) {
  return `
    <div class="admin-field checkbox-field">
      <label><input type="checkbox" data-field="${fieldPath}" data-bool="1" ${checked ? "checked" : ""}> ${label}</label>
    </div>`;
}

// Zoom 场次时间清单：可以加好几场，网站会自动挑最近的一场倒数。
// 用「+ 加一场 / 移除」直接操作画面上的元素，不会重新整个板块，才不会把你还没保存的其他文字栏位盖掉。
function sessionsField(sessions) {
  const rows = (sessions || []).map((s, i) => `
    <div class="session-row">
      <input type="datetime-local" data-field="_sessions.${i}" value="${s || ""}">
      <button type="button" class="link-btn remove-session">移除</button>
    </div>`).join("");
  return `
    <div class="admin-field">
      <label>Zoom 场次时间（可以加好几场，网站会自动显示「距离最近一场还有多久」，都当作马来西亚/新加坡时间）</label>
      <div id="sessions-list">${rows}</div>
      <button type="button" class="link-btn" id="add-session-btn">+ 加一场</button>
    </div>`;
}

async function handleImageUpload(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const wrapper = inputEl.closest(".img-field");
  const statusEl = wrapper.querySelector(".img-upload-status");
  const previewEl = wrapper.querySelector(".img-preview");
  const hiddenInput = wrapper.querySelector('input[type="hidden"]');

  statusEl.textContent = "上传中...";

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage.from("site-images").upload(path, file, { upsert: true });
  if (uploadError) {
    statusEl.textContent = "上传失败：" + uploadError.message + "（常见原因：Supabase 里还没建立 site-images 这个 Storage bucket）";
    return;
  }

  const { data } = supabaseClient.storage.from("site-images").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  hiddenInput.value = publicUrl;
  previewEl.innerHTML = `<img src="${publicUrl}" alt="">`;
  statusEl.textContent = "上传成功！记得点下面的「保存」按钮，网站才会真的更新。";
}

function renderSection(key, data) {
  let inner = "";

  if (key === "hero") {
    inner += imageField("image", "Hero 背景图", data.hero.image);
  }
  if (key === "kate") {
    inner += imageField("image", "Kate 创办人照片", data.kate.image);
  }
  if (key === "brand") {
    inner += imageField("logo_image", "MAE Logo", data.brand.logo_image);
    inner += imageField("product_image", "产品图", data.brand.product_image);
    inner += imageField("cert_image", "纪录认证证书照片", data.brand.cert_image);
  }

  if (TEXT_FIELDS[key]) {
    inner += TEXT_FIELDS[key].map(([f, label, type]) => textInput(f, label, type, data[key][f])).join("");
  }

  if (key === "event") {
    inner += sessionsField(data.event.sessions);
  }
  if (key === "register") {
    inner += checkboxField("show_counter", "在报名按钮旁显示「已有 XX 人报名」", data.register.show_counter);
  }

  if (key === "highlights") {
    inner += data.highlights.map((h, i) => `
      <div class="admin-field" style="border-top:1px solid var(--card-border);padding-top:12px;">
        <label>Emoji</label><input type="text" data-field="_arr.${i}.emoji" value="${h.emoji}">
        <label style="margin-top:10px;">标题</label><input type="text" data-field="_arr.${i}.title" value="${h.title.replace(/"/g, "&quot;")}">
        <label style="margin-top:10px;">描述</label><textarea data-field="_arr.${i}.desc">${h.desc}</textarea>
      </div>`).join("");
  }

  if (key === "milestones") {
    const images = data.milestones.images || [];
    inner += data.milestones.captions.map((cap, i) => imageField(`_milestone_img.${i}`, `照片 ${i + 1}`, images[i])).join("");
    inner += `<div class="admin-field"><label>照片说明（每行一条，共 8 条，顺序对应上面的照片）</label>
      <textarea data-field="_captions" rows="8">${data.milestones.captions.join("\n")}</textarea></div>`;
  }

  if (key === "results") {
    inner += data.results.items.map((r, i) => `
      <div class="admin-field" style="border-top:1px solid var(--card-border);padding-top:12px;">
        ${imageField(`_items.${i}.image`, "照片", r.image)}
        <label>姓名/身份</label><input type="text" data-field="_items.${i}.who" value="${r.who.replace(/"/g, "&quot;")}">
        <label style="margin-top:10px;">见证内容</label><textarea data-field="_items.${i}.quote">${r.quote}</textarea>
        <label style="margin-top:10px;">IG 原帖网址（选填，填了见证卡片下面会出现「查看 IG 原帖」的连结）</label>
        <input type="text" placeholder="https://www.instagram.com/p/..." data-field="_items.${i}.ig_link" value="${(r.ig_link || "").replace(/"/g, "&quot;")}">
      </div>`).join("");
  }

  if (key === "faq") {
    inner += `<div class="admin-field"><label>适合参与（每行一条）</label>
      <textarea data-field="_good" rows="7">${data.faq.good.join("\n")}</textarea></div>`;
    inner += `<div class="admin-field"><label>可能不适合（每行一条）</label>
      <textarea data-field="_bad" rows="3">${data.faq.bad.join("\n")}</textarea></div>`;
    inner += data.faq.items.map((f, i) => `
      <div class="admin-field" style="border-top:1px solid var(--card-border);padding-top:12px;">
        <label>问题</label><input type="text" data-field="_items.${i}.q" value="${f.q.replace(/"/g, "&quot;")}">
        <label style="margin-top:10px;">回答</label><textarea data-field="_items.${i}.a">${f.a}</textarea>
      </div>`).join("");
  }

  return `
    <div class="admin-section card" data-section="${key}">
      <h3>${SECTION_LABELS[key]} <button class="btn save-btn" data-save="${key}">保存</button></h3>
      ${inner}
      <div class="form-msg ok" data-savemsg="${key}" style="margin-top:10px;">已保存，网站会立即更新。</div>
    </div>`;
}

// 「网站板块排版」卡片：拖拽调整顺序 + 勾选隐藏。这个不是普通的文字栏位，保存逻辑另外处理（见 saveSection）。
function renderLayoutSection(data) {
  const layout = data.layout || DEFAULT_CONTENT.layout;
  const order = (layout.order && layout.order.length) ? layout.order : DEFAULT_CONTENT.layout.order;
  const hidden = layout.hidden || [];
  const rows = order.map(key => `
    <div class="layout-row" data-layout-key="${key}">
      <span class="drag-handle">☰</span>
      <span class="layout-label">${SECTION_LABELS[key] || key}</span>
      <label class="layout-hide"><input type="checkbox" class="layout-hide-checkbox" ${hidden.includes(key) ? "checked" : ""}> 隐藏</label>
    </div>`).join("");
  return `
    <div class="admin-section card" data-section="layout">
      <h3>网站板块排版 <button class="btn save-btn" data-save="layout">保存</button></h3>
      <p class="hint">拖拽左边的 ☰ 调整板块出现的先后顺序；勾选「隐藏」可以先不显示某个板块（内容不会不见，只是网站上先不显示）。</p>
      <div id="layout-list">${rows}</div>
      <div class="form-msg ok" data-savemsg="layout" style="margin-top:10px;">已保存，网站会立即更新。</div>
    </div>`;
}

function renderAllSections() {
  const order = ["hero", "kate", "opportunity", "system", "highlights", "brand", "milestones", "event", "results", "faq", "register", "closing", "footer"];
  document.getElementById("sections").innerHTML =
    renderLayoutSection(currentContent) + order.map(k => renderSection(k, currentContent)).join("");

  document.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", () => saveSection(btn.getAttribute("data-save")));
  });

  document.querySelectorAll(".img-file-input").forEach(input => {
    input.addEventListener("change", () => handleImageUpload(input));
  });

  const layoutList = document.getElementById("layout-list");
  if (layoutList && window.Sortable) {
    new Sortable(layoutList, { handle: ".drag-handle", animation: 150 });
  }

  // Zoom 场次「+ 加一场 / 移除」用事件委派处理，直接操作画面元素，
  // 不会重新整个板块，其他还没保存的文字栏位才不会被盖掉。
  const sectionsEl = document.getElementById("sections");
  sectionsEl.addEventListener("click", (e) => {
    if (e.target.id === "add-session-btn") {
      const list = e.target.previousElementSibling; // #sessions-list 紧接在按钮前面
      const idx = list.children.length;
      const row = document.createElement("div");
      row.className = "session-row";
      row.innerHTML = `<input type="datetime-local" data-field="_sessions.${idx}"><button type="button" class="link-btn remove-session">移除</button>`;
      list.appendChild(row);
    }
    if (e.target.classList.contains("remove-session")) {
      const list = e.target.closest("#sessions-list");
      e.target.closest(".session-row").remove();
      list.querySelectorAll(".session-row input[data-field]").forEach((inp, i) => {
        inp.setAttribute("data-field", `_sessions.${i}`);
      });
    }
  });
}

async function loadMergedContent() {
  const merged = JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  const { data, error } = await supabaseClient.from("page_content").select("id, content");
  if (!error && data) {
    data.forEach(row => {
      if (merged[row.id] !== undefined) {
        if (Array.isArray(merged[row.id])) {
          Object.assign(merged[row.id], row.content);
        } else {
          merged[row.id] = Object.assign({}, merged[row.id], row.content);
        }
      }
    });
  }
  currentContent = merged;
  renderAllSections();
}

async function saveSection(key) {
  if (key === "layout") {
    await saveLayout();
    return;
  }

  const card = document.querySelector(`[data-section="${key}"]`);
  const msg = card.querySelector(`[data-savemsg="${key}"]`);
  const updated = JSON.parse(JSON.stringify(currentContent[key]));

  // Zoom 场次是一个清单，先收集起来最后再一次覆盖，
  // 这样删除过某几场之后，才不会留下旧的空位。
  const sessionsList = [];

  card.querySelectorAll("[data-field]").forEach(el => {
    const path = el.getAttribute("data-field");
    const val = el.getAttribute("data-bool") === "1" ? el.checked : el.value;

    if (path.startsWith("_arr.")) {
      const [, idx, field] = path.split(".");
      updated[idx][field] = val;
    } else if (path === "_captions") {
      updated.captions = val.split("\n");
    } else if (path.startsWith("_milestone_img.")) {
      const idx = path.split(".")[1];
      if (!updated.images) updated.images = [];
      updated.images[idx] = val;
    } else if (path.startsWith("_items.")) {
      const [, idx, field] = path.split(".");
      updated.items[idx][field] = val;
    } else if (path.startsWith("_sessions.")) {
      const idx = Number(path.split(".")[1]);
      sessionsList[idx] = val;
    } else if (path === "_good") {
      updated.good = val.split("\n");
    } else if (path === "_bad") {
      updated.bad = val.split("\n");
    } else {
      updated[path] = val;
    }
  });

  if (key === "event") {
    updated.sessions = sessionsList.filter(Boolean);
  }

  currentContent[key] = updated;

  const { error } = await supabaseClient.from("page_content").upsert({ id: key, content: updated, updated_at: new Date().toISOString() });
  if (error) {
    alert("保存失败：" + error.message + "\n\n（常见原因：还没在 Supabase 的 admins 表里加入你的帐号，参考 supabase/schema.sql 最下面的说明）");
    return;
  }
  msg.classList.add("show");
  setTimeout(() => msg.classList.remove("show"), 2500);
}

// 「网站板块排版」的保存逻辑跟其他板块不一样：不是读文字栏位，
// 是直接读画面上 .layout-row 现在的顺序 + 每一行的隐藏勾选框状态。
async function saveLayout() {
  const msg = document.querySelector('[data-savemsg="layout"]');
  const rows = document.querySelectorAll("#layout-list .layout-row");
  const order = [];
  const hidden = [];
  rows.forEach(row => {
    const key = row.getAttribute("data-layout-key");
    order.push(key);
    if (row.querySelector(".layout-hide-checkbox").checked) hidden.push(key);
  });
  const updated = { order, hidden };
  currentContent.layout = updated;

  const { error } = await supabaseClient.from("page_content").upsert({ id: "layout", content: updated, updated_at: new Date().toISOString() });
  if (error) {
    alert("保存失败：" + error.message);
    return;
  }
  if (msg) {
    msg.classList.add("show");
    setTimeout(() => msg.classList.remove("show"), 2500);
  }
}

async function loadLeads() {
  const tbody = document.getElementById("leads-body");
  const { data, error } = await supabaseClient
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="8">读取失败：${error.message}</td></tr>`;
    return;
  }
  lastLeadsRows = data || [];

  tbody.innerHTML = lastLeadsRows.map((r, i) => `
    <tr>
      <td>${new Date(r.created_at).toLocaleString("zh-CN")}</td>
      <td>${r.name || ""}</td>
      <td>${r.email || ""}</td>
      <td>${r.phone || ""}</td>
      <td>${r.city || ""}</td>
      <td>${r.agent_code || "Kate"}</td>
      <td>${r.utm_source ? (r.utm_source + (r.utm_medium ? " / " + r.utm_medium : "")) : ""}</td>
      <td>${emailButtonHtml(i)}</td>
    </tr>`).join("") || `<tr><td colspan="8">暂时没有报名资料</td></tr>`;

  document.querySelectorAll(".email-open-btn").forEach(btn => {
    btn.addEventListener("click", () => openGmailForLead(Number(btn.getAttribute("data-idx"))));
  });

  loadOverview(lastLeadsRows);
}

// 每一行报名资料后面的「Email」栏位：一个模板下拉选单 + 一个开 Gmail 的按钮。
function emailButtonHtml(idx) {
  const templates = (currentContent.email_templates && currentContent.email_templates.items) || [];
  if (!templates.length) return `<span class="hint">还没有设置模板</span>`;
  const options = templates.map((t, i) => `<option value="${i}">${t.label}</option>`).join("");
  return `
    <div class="email-cell">
      <select class="email-select" data-idx="${idx}">${options}</select>
      <button type="button" class="link-btn email-open-btn" data-idx="${idx}">Email</button>
    </div>`;
}

// 点「Email」：挑好的模板内容套上这笔资料的姓名，开一个新分页的 Gmail 编辑窗口
// （只是帮你把 Gmail 打开、内容带好，还是要你自己按送出——不会自动发信）。
function openGmailForLead(idx) {
  const row = lastLeadsRows[idx];
  if (!row || !row.email) return;
  const select = document.querySelector(`.email-select[data-idx="${idx}"]`);
  const templates = (currentContent.email_templates && currentContent.email_templates.items) || [];
  const tpl = templates[Number(select ? select.value : 0)] || templates[0];
  if (!tpl) return;
  const name = row.name || "";
  const subject = (tpl.subject || "").replace(/\{\{name\}\}/g, name);
  const body = (tpl.body || "").replace(/\{\{name\}\}/g, name);
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(row.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank");
}

// 报名数据 Overview：总人数 + 按天趋势（最近 14 天）+ 每个代理带来几人。
function loadOverview(rows) {
  const el = document.getElementById("leads-overview");
  if (!el) return;
  const total = rows.length;

  const dayMap = {};
  rows.forEach(r => {
    const d = new Date(r.created_at);
    const key = d.toLocaleDateString("zh-CN", { timeZone: "Asia/Kuala_Lumpur" });
    dayMap[key] = (dayMap[key] || 0) + 1;
  });
  const dayRows = Object.keys(dayMap).sort().reverse().slice(0, 14).map(k => `
    <div class="trend-row"><span>${k}</span><span>${dayMap[k]} 人</span></div>`).join("")
    || `<div class="trend-row"><span>暂无资料</span></div>`;

  const agentMap = {};
  rows.forEach(r => {
    const key = r.agent_code || "Kate（无代理代码）";
    agentMap[key] = (agentMap[key] || 0) + 1;
  });
  const agentRows = Object.entries(agentMap).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
    <div class="trend-row"><span>${k}</span><span>${v} 人</span></div>`).join("")
    || `<div class="trend-row"><span>暂无资料</span></div>`;

  el.innerHTML = `
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">总报名人数</div></div>
    <div class="trend-block"><h4>按天报名趋势（最近 14 天）</h4><div class="trend-list">${dayRows}</div></div>
    <div class="trend-block"><h4>每个代理带来几人</h4><div class="trend-list">${agentRows}</div></div>`;
}

// 导出 CSV：前面加 ﻿（BOM）是为了让 Excel 打开时中文不会变乱码。
function exportCsv() {
  const rows = lastLeadsRows;
  const header = ["提交时间", "姓名", "邮箱", "电话", "城市", "留言", "代理代码", "utm_source", "utm_medium"];
  const lines = [header.join(",")];
  rows.forEach(r => {
    const cells = [
      new Date(r.created_at).toLocaleString("zh-CN"),
      r.name || "", r.email || "", r.phone || "", r.city || "",
      (r.message || "").replace(/\n/g, " "), r.agent_code || "", r.utm_source || "", r.utm_medium || ""
    ];
    lines.push(cells.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  });
  const csv = "﻿" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `报名名单_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// Email 模板 Tab：管理报名名单那边点「Email」时可以挑选的内容模板。
// {{name}} 之后会自动换成该笔报名资料的姓名。
// ============================================================
function renderTemplates() {
  const container = document.getElementById("templates-list");
  if (!container) return;
  if (!currentContent.email_templates) currentContent.email_templates = { items: [] };
  const items = currentContent.email_templates.items || [];

  container.innerHTML = items.map((t, i) => `
    <div class="admin-section card" data-template-idx="${i}">
      <h3>模板 ${i + 1} <button type="button" class="link-btn remove-template" data-idx="${i}">删除这个模板</button></h3>
      <div class="admin-field"><label>模板名称（给自己看，方便挑选）</label>
        <input type="text" class="tpl-field" data-tpl-field="label" value="${(t.label || "").replace(/"/g, "&quot;")}"></div>
      <div class="admin-field"><label>邮件标题</label>
        <input type="text" class="tpl-field" data-tpl-field="subject" value="${(t.subject || "").replace(/"/g, "&quot;")}"></div>
      <div class="admin-field"><label>邮件内容（可以用 {{name}} 代表这笔报名资料的姓名）</label>
        <textarea class="tpl-field" data-tpl-field="body" rows="6">${t.body || ""}</textarea></div>
    </div>`).join("") || `<p class="hint">还没有模板，点下面「+ 新增模板」加一个。</p>`;

  container.querySelectorAll(".remove-template").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      currentContent.email_templates.items.splice(idx, 1);
      renderTemplates();
    });
  });
}

function collectTemplatesFromDom() {
  const cards = document.querySelectorAll("#templates-list [data-template-idx]");
  const items = [];
  cards.forEach(card => {
    const item = {};
    card.querySelectorAll(".tpl-field").forEach(el => {
      item[el.getAttribute("data-tpl-field")] = el.value;
    });
    items.push(item);
  });
  return items;
}

async function saveTemplates() {
  const items = collectTemplatesFromDom();
  const updated = { items };
  currentContent.email_templates = updated;

  const { error } = await supabaseClient.from("page_content").upsert({ id: "email_templates", content: updated, updated_at: new Date().toISOString() });
  const msg = document.getElementById("templates-save-msg");
  if (error) {
    alert("保存失败：" + error.message);
    return;
  }
  if (msg) {
    msg.classList.add("show");
    setTimeout(() => msg.classList.remove("show"), 2500);
  }
}

// ============================================================
// 后台三个 Tab（内容排版 / 报名数据 / Email 模板）之间的切换
// ============================================================
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = document.getElementById(btn.getAttribute("data-tab"));
      if (panel) panel.classList.add("active");
    });
  });
}

function showEditor(email) {
  document.getElementById("login-view").style.display = "none";
  document.getElementById("editor-view").style.display = "block";
  document.getElementById("who-email").textContent = email;
  initTabs();
  loadMergedContent().then(() => {
    renderTemplates();
    loadLeads();
  });
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showEditor(session.user.email);
  }

  document.getElementById("login-btn").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errBox = document.getElementById("login-err");
    errBox.style.display = "none";

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errBox.style.display = "block";
      errBox.textContent = "登入失败：" + error.message;
      return;
    }
    showEditor(data.user.email);
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  document.getElementById("refresh-leads").addEventListener("click", loadLeads);

  const exportBtn = document.getElementById("export-csv");
  if (exportBtn) exportBtn.addEventListener("click", exportCsv);

  const addTplBtn = document.getElementById("add-template-btn");
  if (addTplBtn) {
    addTplBtn.addEventListener("click", () => {
      if (!currentContent.email_templates) currentContent.email_templates = { items: [] };
      currentContent.email_templates.items.push({ label: "新模板", subject: "", body: "" });
      renderTemplates();
    });
  }

  const saveTplBtn = document.getElementById("save-templates-btn");
  if (saveTplBtn) saveTplBtn.addEventListener("click", saveTemplates);
}

init();
