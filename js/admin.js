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
  incentive_trip: [["title", "标题", "text"], ["subtitle", "副标题", "textarea"]],
  register: [["p1", "段落 1", "textarea"], ["p2", "段落 2", "textarea"], ["button", "按钮文字", "text"]],
  closing: [["line1", "第一行", "text"], ["line2", "第二行", "text"]],
  footer: [["desc", "品牌简介", "textarea"], ["email", "联系邮箱", "text"], ["phone", "联系电话", "text"], ["address", "地址", "text"]]
};

let lastLeadsRows = []; // 上次读到的报名名单（给 Email 按钮 / CSV 导出用）
let agentLinksList = []; // 上次读到的「专属连接工具」生成过的连接（给报名名单/Overview 对照名字用）
let agentProfilesMap = {}; // 代理自己在 agent-profile.html 填过的名字（code -> name），给 Email 模板 {{agent_name}} 用

// ============================================================
// 专属连接工具：现成 UTM 连接 + 给非 EL002 的人生成专属连接（含查名单连接）
// ============================================================

// 现成的渠道 UTM 连接（不用改代码，直接复制这些去广告/官方帖子用）。
const UTM_LINKS = [
  { label: "Kate 个人分享（无代理归属）", params: "utm_source=kate&utm_medium=personal" },
  { label: "公司 IG 官方帖子", params: "utm_source=ig&utm_medium=organic" },
  { label: "公司 IG Story", params: "utm_source=ig&utm_medium=story" },
  { label: "Facebook 广告", params: "utm_source=fb&utm_medium=ads" },
  { label: "Instagram 广告", params: "utm_source=ig&utm_medium=ads" }
];

function renderUtmLinks() {
  const el = document.getElementById("utm-links-list");
  if (!el) return;
  const origin = location.origin;
  el.innerHTML = UTM_LINKS.map(u => {
    const url = `${origin}/?${u.params}`;
    return `
    <div class="link-row">
      <div class="link-row-label">${u.label}</div>
      <div class="link-row-url mono">${url}</div>
      <button type="button" class="link-btn copy-btn" data-copy="${url}">复制</button>
    </div>`;
  }).join("");
}

// 一键复制：网页上所有 .copy-btn 按钮共用这一个处理（事件委派，不用一个个绑定）。
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy-btn");
  if (!btn) return;
  const text = btn.getAttribute("data-copy") || "";
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "已复制！";
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch (err) {
    alert("复制失败，请手动选取以下网址复制：\n\n" + text);
  }
});

// 读取已经生成过的专属连接（agent_links 表），给「已生成的专属连接」列表 +
// 报名名单/Overview 用（把代理代码换成看得懂的名字标签）。
async function loadAgentLinks() {
  const { data, error } = await supabaseClient
    .from("agent_links")
    .select("code, label, view_token, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("读取专属连接列表失败：", error.message);
    agentLinksList = [];
  } else {
    agentLinksList = data || [];
  }
  renderAgentLinksList();
}

function agentLinkLabelMap() {
  const map = {};
  agentLinksList.forEach(a => { map[a.code] = a.label; });
  return map;
}

// 报名名单/Overview 显示代理代码时，如果这个代码是用「生成专属连接」建的，
// 就换成「标签（代码）」比较看得懂；不是的话（比如 EL002 真正的 Member ID）就照原样显示代码。
function displayAgentCode(code) {
  if (!code) return "Kate";
  const labelMap = agentLinkLabelMap();
  return labelMap[code] ? `${labelMap[code]}（${code}）` : code;
}

// 读取代理自己在 agent-profile.html 填过的名字（跟首页邀请卡片用的是同一份资料），
// 给 Email 模板里的 {{agent_name}} 用。
async function loadAgentProfiles() {
  const { data, error } = await supabaseClient.from("agent_profiles").select("code, name");
  if (error) {
    console.warn("读取代理自我介绍名字失败：", error.message);
    agentProfilesMap = {};
    return;
  }
  agentProfilesMap = {};
  (data || []).forEach(p => { if (p.name) agentProfilesMap[p.code] = p.name; });
}

// {{agent_name}} 要换成的名字：优先用代理自己填的名字（agent_profiles），
// 没填过就退回「专属连接工具」的标签，都没有就用代码本身；完全没有代理代码（裸报名）就是空白。
function agentNameForCode(code) {
  if (!code) return "";
  if (agentProfilesMap[code]) return agentProfilesMap[code];
  const label = agentLinkLabelMap()[code];
  if (label) return label;
  return code;
}

function renderAgentLinksList() {
  const el = document.getElementById("agent-links-list");
  if (!el) return;
  if (!agentLinksList.length) {
    el.innerHTML = `<p class="hint">还没有生成过专属连接。</p>`;
    return;
  }
  const origin = location.origin;
  el.innerHTML = `
    <table class="leads-table">
      <thead><tr><th>标签 / 代码</th><th>邀请连接</th><th>查名单连接</th><th>自我介绍连接</th></tr></thead>
      <tbody>
        ${agentLinksList.map(a => {
          const refUrl = `${origin}/?ref=${a.code}`;
          const listUrl = `${origin}/my-list.html?code=${a.code}&key=${a.view_token}`;
          const profileUrl = `${origin}/agent-profile.html?ref=${a.code}`;
          return `
          <tr>
            <td>${a.label}<br><span class="hint" style="margin:0;">代码：${a.code}</span></td>
            <td><div class="link-row-url mono">${refUrl}</div><button type="button" class="link-btn copy-btn" data-copy="${refUrl}">复制</button></td>
            <td><div class="link-row-url mono">${listUrl}</div><button type="button" class="link-btn copy-btn" data-copy="${listUrl}">复制</button></td>
            <td><div class="link-row-url mono">${profileUrl}</div><button type="button" class="link-btn copy-btn" data-copy="${profileUrl}">复制</button></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

// 随机产生一个不会跟真正 Member ID（格式是 MAE+数字+国家代号）搞混的代码，P 开头方便一眼认出是临时生成的。
function generateAgentCode() {
  const rand = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  return "P" + rand.slice(0, 6).toUpperCase();
}

async function createAgentLink() {
  const input = document.getElementById("agent-link-label");
  const msg = document.getElementById("agent-link-msg");
  const label = (input.value || "").trim();
  msg.classList.remove("show");

  if (!label) {
    msg.textContent = "请先填写名字/标签，再点生成。";
    msg.classList.add("show");
    return;
  }

  const code = generateAgentCode();
  const { error } = await supabaseClient.from("agent_links").insert([{ code, label }]);
  if (error) {
    msg.textContent = "生成失败：" + error.message + "（常见原因：Supabase 里还没跑过 agent_links 那段 SQL）";
    msg.classList.add("show");
    return;
  }

  input.value = "";
  await loadAgentLinks();
  loadLeads(); // 重新整理一次名单，让代理代码显示换成新标签
}

const SECTION_LABELS = {
  hero: "① Hero 首屏", kate: "② Kate 创办人", opportunity: "③ 重新框定机会",
  system: "④ aMAEzing AI GROW System", highlights: "⑤ 四大亮点", brand: "⑥ MAE 品牌背书",
  milestones: "MAE Milestone 画廊", event: "⑦ 时间地点", results: "⑧ 真实成果", incentive_trip: "奖励旅游 Incentive Trip",
  faq: "⑨ 谁适合参与 + FAQ", register: "⑩ 报名区块文案", closing: "⑪ 结尾", footer: "页脚"
};

let currentContent = null; // 合并 Supabase 覆盖后的完整内容（跟 site.js 逻辑一致）

function textInput(id, label, type, value) {
  // 段落型栏位（textarea）改用可以加粗/底线/斜体/字号/颜色的 richTextField；
  // 单行栏位（标题、按钮文字这些）维持原本的纯文字 input，不需要格式。
  if (type === "textarea") return richTextField(id, label, value);
  const safe = (value || "").toString();
  return `<div class="admin-field"><label>${label}</label><input type="text" data-field="${id}" value="${safe.replace(/"/g, "&quot;")}"></div>`;
}

// ------------------------------------------------------------
// 富文本栏位：加粗 / 底线 / 斜体 + 字号（小/中/大）+ 颜色（品牌紫/深灰/白）。
// 不是完全自由的字体/颜色选择器，是刻意限制成几个固定选项——这样 Kate/Amy
// 不管选什么组合，都不会跟网站原本的配色、字体系统冲突、跑版。
// ------------------------------------------------------------
const RICHTEXT_SIZE_OPTIONS = [
  { label: "小", value: "14px" },
  { label: "中", value: "inherit" }, // 「中」= 还原成这个栏位原本的默认字号，不是写死某个数字
  { label: "大", value: "20px" }
];
const RICHTEXT_COLOR_OPTIONS = [
  { label: "品牌紫", value: "#7c3aed" },
  { label: "深灰", value: "#4a4560" },
  { label: "白色（深色背景板块专用，例如满版照片 Hero）", value: "#ffffff" }
];

function richTextField(fieldPath, label, value) {
  const safe = (value || "").toString();
  const sizeBtns = RICHTEXT_SIZE_OPTIONS.map(s =>
    `<button type="button" class="rt-btn rt-size" data-size="${s.value}" title="字号：${s.label}">${s.label}</button>`
  ).join("");
  const colorBtns = RICHTEXT_COLOR_OPTIONS.map(c =>
    `<button type="button" class="rt-btn rt-color" data-color="${c.value}" style="background:${c.value}" title="${c.label}"></button>`
  ).join("");
  return `
    <div class="admin-field richtext-field">
      <label>${label}</label>
      <div class="richtext-toolbar">
        <button type="button" class="rt-btn rt-cmd" data-cmd="bold" title="加粗"><b>B</b></button>
        <button type="button" class="rt-btn rt-cmd" data-cmd="underline" title="底线"><u>U</u></button>
        <button type="button" class="rt-btn rt-cmd" data-cmd="italic" title="斜体"><i>I</i></button>
        <span class="rt-sep"></span>
        ${sizeBtns}
        <span class="rt-sep"></span>
        ${colorBtns}
        <span class="rt-sep"></span>
        <button type="button" class="rt-btn rt-clear" title="清除这段文字的格式">清除格式</button>
      </div>
      <div class="richtext-box" contenteditable="true" data-field="${fieldPath}" data-richtext="1">${safe}</div>
      <p class="rt-hint">先选取文字，再点上面的按钮套用格式。</p>
    </div>`;
}

// 先选取文字再点工具栏按钮时，把选取的内容包进一个新的 <span style="..."> 里。
// 「字号：中」传进来的 size 是 inherit，效果是盖掉之前套过的字号、还原默认大小。
//
// 有一个坑：如果选取的文字「正好」就是之前套过同一种样式（字号或颜色）的整个 span，
// 不能直接在外面再包一层新 span——CSS 的 inherit 是继承「最近的上一层」，如果新的
// inherit span 包在旧的「字号：大」span 里面，会继承到那层「大」，而不是真正的默认大小，
// 「中」按钮等于没用。所以这种情况改成直接修改那个既有 span 的样式，而不是再包一层。
function applyRichStyle(box, prop, value) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !box.contains(sel.anchorNode)) {
    alert("请先在文字框里选取要调整的文字，再点上面的按钮。");
    return;
  }
  const range = sel.getRangeAt(0);

  const container = range.commonAncestorContainer;
  const parentEl = container.nodeType === 1 ? container : container.parentElement;
  const existingSpan =
    parentEl && parentEl !== box && parentEl.tagName === "SPAN" &&
    parentEl.style[prop] && box.contains(parentEl) &&
    range.toString() === parentEl.textContent
      ? parentEl
      : null;

  if (existingSpan) {
    existingSpan.style[prop] = value;
    return;
  }

  const span = document.createElement("span");
  span.style[prop] = value;
  span.appendChild(range.extractContents());
  range.insertNode(span);
  // 把选取范围移到刚刚套上格式的文字，方便接着再套用别的格式（例如先选大字再加粗）
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

// 只允许固定的几种标签/样式值存进 Supabase：从网页、Word、其他地方贴过来的
// 花俏格式（字体、其他颜色、底色、超链接、图片……）都会被拆开只留纯文字，
// 避免把奇怪的格式存进数据库、把网站排版弄乱。
const RT_ALLOWED_TAGS = new Set(["B", "STRONG", "U", "I", "EM", "BR", "SPAN"]);
const RT_ALLOWED_SIZES = new Set(RICHTEXT_SIZE_OPTIONS.map(s => s.value));
const RT_ALLOWED_COLORS = new Set(RICHTEXT_COLOR_OPTIONS.map(c => c.value.toLowerCase()));
// 浏览器有时候会把 style.color 读回来变成 rgb(...) 而不是原本设的 #xxxxxx，两种都要认得
const RT_COLOR_RGB_MAP = { "#7c3aed": "rgb(124, 58, 237)", "#4a4560": "rgb(74, 69, 96)", "#ffffff": "rgb(255, 255, 255)" };
Object.values(RT_COLOR_RGB_MAP).forEach(rgb => RT_ALLOWED_COLORS.add(rgb));

function sanitizeRichText(html) {
  const container = document.createElement("div");
  container.innerHTML = html || "";
  cleanRichNode(container);
  return container.innerHTML;
}

function cleanRichNode(node) {
  Array.from(node.childNodes).forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) return;
    if (child.nodeType !== Node.ELEMENT_NODE) { node.removeChild(child); return; }

    // 先把子节点清干净，才知道这个节点清完之后是不是还有内容值得保留
    cleanRichNode(child);

    const tag = child.tagName;
    if (!RT_ALLOWED_TAGS.has(tag)) {
      // 不在允许清单里的标签（div/p/font/a/img...）：拆开，只留里面已经清过的内容
      while (child.firstChild) node.insertBefore(child.firstChild, child);
      node.removeChild(child);
      return;
    }

    if (tag === "SPAN") {
      const color = (child.style.color || "").toLowerCase();
      const fontSize = child.style.fontSize || "";
      const keep = [];
      if (color && RT_ALLOWED_COLORS.has(color)) keep.push(`color:${color}`);
      if (fontSize && RT_ALLOWED_SIZES.has(fontSize)) keep.push(`font-size:${fontSize}`);
      Array.from(child.attributes).forEach(a => child.removeAttribute(a.name));
      if (keep.length) {
        child.setAttribute("style", keep.join(";"));
      } else {
        // 没有留下任何允许的样式，这个 span 就没意义了，拆开只留文字
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        node.removeChild(child);
      }
    } else {
      // B/STRONG/U/I/EM/BR 不允许带任何属性
      Array.from(child.attributes).forEach(a => child.removeAttribute(a.name));
    }

    // 清完之后如果这个标签已经空了（例如点「清除格式」之后留下的空 <b></b>），
    // 直接拿掉，存进去的内容才干净——BR 例外，空的 <br> 本来就是它该有的样子（换行）。
    if (child.tagName !== "BR" && !child.hasChildNodes()) {
      node.removeChild(child);
    }
  });
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

// 可以自由加/减张数的照片清单：跟 sessionsField 一样，用「+ 加一张照片 / 移除」直接操作
// 画面上的元素，不会重新整个板块，才不会把你还没保存的其他文字栏位盖掉。
// prefix 用来区分是哪个板块的清单（例如 "trip" = Incentive Trip、"brand" = MAE 品牌背书），
// 每一张照片都是一个 imageField，栏位路径是 _<prefix>_img.N，
// 保存的时候 saveSection 会把它们收集成一个清单存回 images 阵列。
function dynamicImageField(prefix, idx, url) {
  const field = imageField(`_${prefix}_img.${idx}`, `照片 ${idx + 1}`, url);
  return `<div class="dyn-img-row" data-dyn-prefix="${prefix}" data-dyn-idx="${idx}">${field}<button type="button" class="link-btn remove-dyn-image" data-dyn-prefix="${prefix}">移除这张</button></div>`;
}

// 整组「照片清单 + 加一张照片按钮」，给 renderSection 直接拼进某个板块的 inner html。
function dynamicImageListBlock(prefix, listId, images) {
  return `<div id="${listId}">${(images || []).map((url, i) => dynamicImageField(prefix, i, url)).join("")}</div>
    <button type="button" class="link-btn add-dyn-image-btn" data-dyn-prefix="${prefix}" data-dyn-list="${listId}">+ 加一张照片</button>`;
}

// 兼容旧版「MAE 品牌背书」的三个固定照片栏位（Logo / 产品图 / 证书照片）：
// 改版后统一变成一个可以自由加/减的照片清单。这里只在还没有 images 清单内容时，
// 把旧栏位里已经上传过的照片带进来，保证旧资料不会因为改版而消失。
function migrateBrandImages(brand) {
  if (Array.isArray(brand.images) && brand.images.length) return brand.images;
  return [brand.logo_image, brand.product_image, brand.cert_image].filter(Boolean);
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
    inner += dynamicImageListBlock("brand", "brand-images-list", migrateBrandImages(data.brand));
    inner += `<p class="hint" style="margin-top:10px;">照片可以自由加/减，不限张数（原本 Logo / 产品图 / 证书照片这三个固定栏位已经自动搬过来了，删掉不需要的那张、保存就好）。</p>`;
  }

  if (TEXT_FIELDS[key]) {
    inner += TEXT_FIELDS[key].map(([f, label, type]) => textInput(f, label, type, data[key][f])).join("");
  }

  if (key === "system") {
    const stageLabels = ["阶段一", "阶段二", "阶段三", "阶段四", "阶段五"];
    inner += (data.system.stages || []).map((s, i) => `
      <div class="admin-field" style="border-top:1px solid var(--card-border);padding-top:12px;">
        <label>${stageLabels[i] || `阶段 ${i + 1}`} · 模块名称</label>
        <input type="text" data-field="_stages.${i}.module" value="${(s.module || "").replace(/"/g, "&quot;")}">
        <label style="margin-top:10px;">${stageLabels[i] || `阶段 ${i + 1}`} · 标题</label>
        <input type="text" data-field="_stages.${i}.title" value="${(s.title || "").replace(/"/g, "&quot;")}">
        ${richTextField(`_stages.${i}.body`, `${stageLabels[i] || `阶段 ${i + 1}`} · 内容`, s.body)}
        <label style="margin-top:10px;display:flex;align-items:center;gap:8px;">
          <input type="checkbox" data-field="_stages.${i}.locked" data-bool="1" ${s.locked ? "checked" : ""}>
          显示为「未解锁 / Coming Soon」（卡片变灰阶 + 出现锁头，开放后取消勾选即可）
        </label>
      </div>`).join("");
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
        ${richTextField(`_arr.${i}.desc`, "描述", h.desc)}
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
        ${richTextField(`_items.${i}.quote`, "见证内容", r.quote)}
        <label style="margin-top:10px;">IG 原帖网址（选填，填了见证卡片下面会出现「查看 IG 原帖」的连结）</label>
        <input type="text" placeholder="https://www.instagram.com/p/..." data-field="_items.${i}.ig_link" value="${(r.ig_link || "").replace(/"/g, "&quot;")}">
      </div>`).join("");
  }

  if (key === "incentive_trip") {
    inner += dynamicImageListBlock("trip", "trip-images-list", data.incentive_trip.images || []);
    inner += `<p class="hint" style="margin-top:10px;">一张照片都还没上传的时候，网站上这个板块会自动隐藏，不会出现空板块。</p>`;
  }

  if (key === "faq") {
    inner += `<div class="admin-field"><label>适合参与（每行一条）</label>
      <textarea data-field="_good" rows="7">${data.faq.good.join("\n")}</textarea></div>`;
    inner += `<div class="admin-field"><label>可能不适合（每行一条）</label>
      <textarea data-field="_bad" rows="3">${data.faq.bad.join("\n")}</textarea></div>`;
    inner += data.faq.items.map((f, i) => `
      <div class="admin-field" style="border-top:1px solid var(--card-border);padding-top:12px;">
        <label>问题</label><input type="text" data-field="_items.${i}.q" value="${f.q.replace(/"/g, "&quot;")}">
        ${richTextField(`_items.${i}.a`, "回答", f.a)}
      </div>`).join("");
  }

  return `
    <div class="admin-section card" data-section="${key}">
      <h3>${SECTION_LABELS[key]} <button class="btn save-btn" data-save="${key}">保存</button></h3>
      ${inner}
      <div class="form-msg ok" data-savemsg="${key}" style="margin-top:10px;">已保存，网站会立即更新。</div>
    </div>`;
}

// 之前存过的「网站排版」顺序清单，可能是在某个新板块（例如 incentive_trip）上线「之前」
// 存的，清单里不会有这个新 key，这张卡片就不会显示它、也没办法拖它调整顺序。
// 这个函数把预设清单里有、但这份（可能是旧的）清单里没有的 key 补进去——
// 补在它在预设清单里最近的、「前一个也在这份清单里」的 key 后面，跟 site.js 的逻辑一致。
function mergeLayoutOrder(savedOrder) {
  const defaultOrder = DEFAULT_CONTENT.layout.order;
  const order = (savedOrder && savedOrder.length) ? savedOrder.slice() : defaultOrder.slice();
  const missing = defaultOrder.filter(k => order.indexOf(k) === -1);
  missing.forEach(key => {
    const defaultIdx = defaultOrder.indexOf(key);
    let insertAfter = -1;
    for (let i = defaultIdx - 1; i >= 0; i--) {
      const idx = order.indexOf(defaultOrder[i]);
      if (idx !== -1) { insertAfter = idx; break; }
    }
    order.splice(insertAfter + 1, 0, key);
  });
  return order;
}

// 「网站板块排版」卡片：拖拽调整顺序 + 勾选隐藏。这个不是普通的文字栏位，保存逻辑另外处理（见 saveSection）。
function renderLayoutSection(data) {
  const layout = data.layout || DEFAULT_CONTENT.layout;
  const order = mergeLayoutOrder(layout.order);
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
  const order = ["hero", "kate", "opportunity", "system", "highlights", "brand", "milestones", "event", "results", "incentive_trip", "faq", "register", "closing", "footer"];
  document.getElementById("sections").innerHTML =
    renderLayoutSection(currentContent) + order.map(k => renderSection(k, currentContent)).join("");

  document.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", () => saveSection(btn.getAttribute("data-save")));
  });

  const layoutList = document.getElementById("layout-list");
  if (layoutList && window.Sortable) {
    new Sortable(layoutList, { handle: ".drag-handle", animation: 150 });
  }

  // 富文本工具栏（B/U/I/字号/颜色/清除格式）按钮：点击前先用 mousedown
  // 拦掉浏览器默认的「移开焦点」动作，不然文字框里选取的文字会在按钮
  // 被点到之前就先被取消选取，格式会套用不到东西上。
  const sectionsEl = document.getElementById("sections");
  sectionsEl.addEventListener("mousedown", (e) => {
    if (e.target.closest(".rt-btn")) e.preventDefault();
  });

  // 图片上传的 change 事件改用事件委派（不是渲染当下一个个绑定），
  // 这样「Incentive Trip」用「+ 加一张照片」动态加出来的新档案输入框，
  // 不用整个板块重新渲染，也能正常触发上传。
  sectionsEl.addEventListener("change", (e) => {
    if (e.target.classList.contains("img-file-input")) {
      handleImageUpload(e.target);
    }
  });

  // Zoom 场次「+ 加一场 / 移除」用事件委派处理，直接操作画面元素，
  // 不会重新整个板块，其他还没保存的文字栏位才不会被盖掉。
  sectionsEl.addEventListener("click", (e) => {
    const rtBtn = e.target.closest(".rt-btn");
    if (rtBtn) {
      const box = rtBtn.closest(".richtext-field").querySelector(".richtext-box");
      if (box) {
        box.focus();
        if (rtBtn.dataset.cmd) {
          document.execCommand(rtBtn.dataset.cmd);
        } else if (rtBtn.classList.contains("rt-size")) {
          applyRichStyle(box, "fontSize", rtBtn.dataset.size);
        } else if (rtBtn.classList.contains("rt-color")) {
          applyRichStyle(box, "color", rtBtn.dataset.color);
        } else if (rtBtn.classList.contains("rt-clear")) {
          document.execCommand("removeFormat");
        }
      }
      return;
    }
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
    // 通用的「+ 加一张照片」：Incentive Trip、MAE 品牌背书都共用，加一个空的照片上传栏位，不用整个板块重新渲染。
    if (e.target.classList.contains("add-dyn-image-btn")) {
      const prefix = e.target.getAttribute("data-dyn-prefix");
      const listId = e.target.getAttribute("data-dyn-list");
      const list = document.getElementById(listId);
      const idx = list.children.length;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = dynamicImageField(prefix, idx, "");
      list.appendChild(wrapper.firstElementChild);
    }
    // 通用的「移除这张」：移除这一张照片栏位，并把后面栏位的 data-field 编号往前挪，
    // 保存的时候才会照正确顺序收集成一个没有空位的 images 清单。
    if (e.target.classList.contains("remove-dyn-image")) {
      const prefix = e.target.getAttribute("data-dyn-prefix");
      const row = e.target.closest(".dyn-img-row");
      const list = row.parentElement;
      row.remove();
      list.querySelectorAll(".dyn-img-row").forEach((r, i) => {
        r.setAttribute("data-dyn-idx", i);
        const hidden = r.querySelector('input[type="hidden"]');
        if (hidden) hidden.setAttribute("data-field", `_${prefix}_img.${i}`);
        const label = r.querySelector(".admin-field > label");
        if (label) label.textContent = `照片 ${i + 1}`;
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
  // Incentive Trip 照片也是一个清单，先收集起来最后再一次覆盖，
  // 这样移除过某几张照片之后，才不会留下旧的空位。
  const tripImagesList = [];
  // MAE 品牌背书的照片现在也改成清单了，跟 Incentive Trip 用同一套收集逻辑。
  const brandImagesList = [];

  card.querySelectorAll("[data-field]").forEach(el => {
    const path = el.getAttribute("data-field");
    // 三种栏位类型：勾选框读 .checked；富文本框（contenteditable 的 div，没有 .value）
    // 要读 .innerHTML 再清过一遍格式；其他一般栏位（input/textarea）读 .value。
    let val;
    if (el.getAttribute("data-bool") === "1") {
      val = el.checked;
    } else if (el.getAttribute("data-richtext") === "1") {
      val = sanitizeRichText(el.innerHTML);
    } else {
      val = el.value;
    }

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
    } else if (path.startsWith("_stages.")) {
      const [, idx, field] = path.split(".");
      updated.stages[idx][field] = val;
    } else if (path.startsWith("_sessions.")) {
      const idx = Number(path.split(".")[1]);
      sessionsList[idx] = val;
    } else if (path.startsWith("_trip_img.")) {
      const idx = Number(path.split(".")[1]);
      tripImagesList[idx] = val;
    } else if (path.startsWith("_brand_img.")) {
      const idx = Number(path.split(".")[1]);
      brandImagesList[idx] = val;
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
  if (key === "incentive_trip") {
    updated.images = tripImagesList.filter(Boolean);
  }
  if (key === "brand") {
    updated.images = brandImagesList.filter(Boolean);
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
    tbody.innerHTML = `<tr><td colspan="11">读取失败：${error.message}</td></tr>`;
    return;
  }
  lastLeadsRows = data || [];

  renderLeadsTable();
  updateNextSessionHint();
  loadOverview(lastLeadsRows);
}

// 把 lastLeadsRows 画到表格上——单独拆出来，是因为「只显示还没提醒的」这个筛选
// 只需要重新画表格，不用重新去 Supabase 抓一次资料。
function renderLeadsTable() {
  const tbody = document.getElementById("leads-body");
  if (!tbody) return;
  const onlyUnreminded = document.getElementById("filter-unreminded");
  const filtered = (onlyUnreminded && onlyUnreminded.checked)
    ? lastLeadsRows.filter(r => !r.reminded)
    : lastLeadsRows;

  tbody.innerHTML = filtered.map(r => {
    const i = lastLeadsRows.indexOf(r); // Email 按钮用「在完整名单里的位置」，跟筛选无关
    return `
    <tr>
      <td>${new Date(r.created_at).toLocaleString("zh-CN")}</td>
      <td>${r.name || ""}</td>
      <td>${r.email || ""}</td>
      <td>${r.phone || ""}</td>
      <td>${r.city || ""}</td>
      <td>${r.intent || ""}</td>
      <td>${displayAgentCode(r.agent_code)}</td>
      <td>${r.utm_source ? (r.utm_source + (r.utm_medium ? " / " + r.utm_medium : "")) : ""}</td>
      <td>${remarkInputHtml(r.id, r.remark)}</td>
      <td>${remindedCheckboxHtml(r.id, r.reminded)}</td>
      <td>${emailButtonHtml(i)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="11">${onlyUnreminded && onlyUnreminded.checked ? "都已经提醒过了，没有还没提醒的人" : "暂时没有报名资料"}</td></tr>`;

  document.querySelectorAll(".email-open-btn").forEach(btn => {
    btn.addEventListener("click", () => openGmailForLead(Number(btn.getAttribute("data-idx"))));
  });

  document.querySelectorAll(".remark-input").forEach(input => {
    input.addEventListener("change", () => saveRemark(input));
  });

  document.querySelectorAll(".reminded-checkbox").forEach(cb => {
    cb.addEventListener("change", () => saveReminded(cb));
  });
}

// 「备注/负责人」栏位：例如裸报名（没有代理代码）的先标记「待分配」，之后确定 leader 人选再回来填名字。
function remarkInputHtml(id, remark) {
  const safe = (remark || "").toString().replace(/"/g, "&quot;");
  return `<input type="text" class="remark-input" data-id="${id}" value="${safe}" placeholder="例如：待分配">`;
}

async function saveRemark(input) {
  const id = input.getAttribute("data-id");
  const value = input.value.trim();
  input.disabled = true;
  const { error } = await supabaseClient.from("registrations").update({ remark: value }).eq("id", id);
  input.disabled = false;
  if (error) {
    alert("备注保存失败：" + error.message);
    return;
  }
  const row = lastLeadsRows.find(r => r.id === id);
  if (row) row.remark = value;
}

// 「提醒」栏位：Zoom 前一天用 Email 按钮发完提醒信之后，勾起来代表「这个人处理过了」。
function remindedCheckboxHtml(id, reminded) {
  return `<input type="checkbox" class="reminded-checkbox" data-id="${id}" ${reminded ? "checked" : ""}>`;
}

async function saveReminded(checkbox) {
  const id = checkbox.getAttribute("data-id");
  const value = checkbox.checked;
  checkbox.disabled = true;
  const { error } = await supabaseClient.from("registrations").update({ reminded: value }).eq("id", id);
  checkbox.disabled = false;
  if (error) {
    alert("提醒状态保存失败：" + error.message);
    checkbox.checked = !value;
    return;
  }
  const row = lastLeadsRows.find(r => r.id === id);
  if (row) row.reminded = value;
  // 如果正在筛选「只显示还没提醒的」，勾了之后这一行要马上从列表消失。
  const onlyUnreminded = document.getElementById("filter-unreminded");
  if (onlyUnreminded && onlyUnreminded.checked) renderLeadsTable();
}

// 找出 event.sessions 里「还没开始、离现在最近」的一场，在报名名单上方提示一句，
// 方便对照「提醒名单」要提醒的是哪一场。逻辑跟前台倒数计时用的是同一个判断方式。
function getNearestSessionText() {
  const sessions = (currentContent && currentContent.event && currentContent.event.sessions) || [];
  const upcoming = sessions
    .filter(Boolean)
    .map(s => new Date(s.length === 16 ? s + ":00+08:00" : s))
    .filter(d => !isNaN(d.getTime()) && d.getTime() > Date.now())
    .sort((a, b) => a - b);
  if (!upcoming.length) return "目前后台还没有设置未来的 Zoom 场次（在「内容 & 排版」Tab 的「⑦ 时间地点」可以加场次）。";
  const target = upcoming[0];
  const diffDays = Math.ceil((target.getTime() - Date.now()) / 86400000);
  return `最近一场 Zoom：${target.toLocaleString("zh-CN", { timeZone: "Asia/Kuala_Lumpur" })}（还有 ${diffDays} 天），提醒名单建议这场开始前一天处理完。`;
}

function updateNextSessionHint() {
  const el = document.getElementById("next-session-hint");
  if (el) el.textContent = getNearestSessionText();
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
  const agentName = agentNameForCode(row.agent_code);
  const subject = (tpl.subject || "").replace(/\{\{name\}\}/g, name).replace(/\{\{agent_name\}\}/g, agentName);
  const body = (tpl.body || "").replace(/\{\{name\}\}/g, name).replace(/\{\{agent_name\}\}/g, agentName);
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
    const key = r.agent_code ? displayAgentCode(r.agent_code) : "Kate（无代理代码）";
    agentMap[key] = (agentMap[key] || 0) + 1;
  });
  const agentRows = Object.entries(agentMap).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
    <div class="trend-row"><span>${k}</span><span>${v} 人</span></div>`).join("")
    || `<div class="trend-row"><span>暂无资料</span></div>`;

  // 按渠道来源统计：只看有带 utm_source 的报名（公司自己发的渠道），代理专属连接不算在这里面。
  const sourceMap = {};
  rows.forEach(r => {
    if (!r.utm_source) return;
    const key = r.utm_source + (r.utm_medium ? " / " + r.utm_medium : "");
    sourceMap[key] = (sourceMap[key] || 0) + 1;
  });
  const sourceRows = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
    <div class="trend-row"><span>${k}</span><span>${v} 人</span></div>`).join("")
    || `<div class="trend-row"><span>暂无资料（还没有用带 utm_source 的连接带来报名）</span></div>`;

  // 按意向等级统计：看这批报名的人大概是什么意向组成。
  const intentMap = {};
  rows.forEach(r => {
    const key = r.intent || "未填写";
    intentMap[key] = (intentMap[key] || 0) + 1;
  });
  const intentRows = Object.entries(intentMap).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
    <div class="trend-row"><span>${k}</span><span>${v} 人</span></div>`).join("")
    || `<div class="trend-row"><span>暂无资料</span></div>`;

  const unremindedCount = rows.filter(r => !r.reminded).length;

  el.innerHTML = `
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">总报名人数</div></div>
    <div class="stat-card"><div class="stat-num">${unremindedCount}</div><div class="stat-label">还没标记「已提醒」的人数</div></div>
    <div class="trend-block"><h4>按天报名趋势（最近 14 天）</h4><div class="trend-list">${dayRows}</div></div>
    <div class="trend-block"><h4>每个代理带来几人</h4><div class="trend-list">${agentRows}</div></div>
    <div class="trend-block"><h4>按渠道来源统计</h4><div class="trend-list">${sourceRows}</div></div>
    <div class="trend-block"><h4>按意向等级统计</h4><div class="trend-list">${intentRows}</div></div>`;
}

// 导出 CSV：前面加 ﻿（BOM）是为了让 Excel 打开时中文不会变乱码。
function exportCsv() {
  const rows = lastLeadsRows;
  const header = ["提交时间", "姓名", "邮箱", "电话", "城市", "意向", "留言", "代理代码", "utm_source", "utm_medium", "备注", "已提醒"];
  const lines = [header.join(",")];
  rows.forEach(r => {
    const cells = [
      new Date(r.created_at).toLocaleString("zh-CN"),
      r.name || "", r.email || "", r.phone || "", r.city || "", r.intent || "",
      (r.message || "").replace(/\n/g, " "), r.agent_code || "", r.utm_source || "", r.utm_medium || "", r.remark || "",
      r.reminded ? "是" : "否"
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
// {{name}} 会自动换成该笔报名资料的姓名，{{agent_name}} 会自动换成
// 带来这笔报名的代理名字（没有代理归属的裸报名会自动留空）。
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
      <div class="admin-field"><label>邮件内容（可以用 {{name}} 代表这笔报名资料的姓名，{{agent_name}} 代表带来这笔报名的代理名字——没有代理归属的裸报名会自动留空）</label>
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
  loadMergedContent().then(async () => {
    renderTemplates();
    renderUtmLinks();
    await loadAgentLinks(); // 要先读到标签对照表，报名名单/Overview 才能正确显示名字
    await loadAgentProfiles(); // 读代理自己填过的名字，给 Email 模板 {{agent_name}} 用
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

  const filterUnreminded = document.getElementById("filter-unreminded");
  if (filterUnreminded) filterUnreminded.addEventListener("change", renderLeadsTable);

  const exportBtn = document.getElementById("export-csv");
  if (exportBtn) exportBtn.addEventListener("click", exportCsv);

  const createLinkBtn = document.getElementById("create-agent-link-btn");
  if (createLinkBtn) createLinkBtn.addEventListener("click", createAgentLink);

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
